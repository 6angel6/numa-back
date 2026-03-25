import { Request, Response, NextFunction } from 'express';
import { PAYME_ERR }  from '../dto/paymeDto';
import logger         from '../../../shared/utils/logger';

/**
 * Payme Business only sends callbacks from these IPs.
 * Ref: https://developer.help.paycom.uz/
 */
const PAYME_IPS = new Set([
   '185.234.113.1',  '185.234.113.2',  '185.234.113.3',
   '185.234.113.4',  '185.234.113.5',  '185.234.113.6',
   '185.234.113.7',  '185.234.113.8',  '185.234.113.9',
   '185.234.113.10', '185.234.113.11', '185.234.113.12',
   '185.234.113.13', '185.234.113.14', '185.234.113.15',
]);

function rpcDeny(res: Response, id: number | null, code: number, message: string): void {
   res.status(200).json({
      error: {
         code,
         message: { ru: message, uz: message, en: message },
      },
      id,
   });
}

/**
 * Validates:
 *   1. IP whitelist  — request must come from one of Payme's known IPs.
 *   2. Basic auth    — Authorization: Basic base64(Paycom:<PAYME_KEY>)
 *
 * In development (NODE_ENV !== 'production') IP check is skipped so you can
 * test locally. Never disable the auth check.
 */
export function paymeAuth(req: Request, res: Response, next: NextFunction): void {
   const rpcId = (req.body?.id as number | undefined) ?? null;
   const isProd = process.env.NODE_ENV === 'production';

   // ── 1. IP whitelist ─────────────────────────────────────────────────────
   if (isProd) {
      // Trust X-Forwarded-For when behind nginx/reverse proxy
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded
         ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]).trim()
         : req.socket.remoteAddress?.replace('::ffff:', '') ?? '';

      if (!PAYME_IPS.has(ip)) {
         logger.warn({ ip, path: req.path }, 'payme: unauthorized IP rejected');
         rpcDeny(res, rpcId, PAYME_ERR.INSUFFICIENT_PRIV, 'Insufficient privileges');
         return;
      }
   }

   // ── 2. Basic auth ───────────────────────────────────────────────────────
   const authHeader = req.headers.authorization ?? '';
   if (!authHeader.startsWith('Basic ')) {
      rpcDeny(res, rpcId, PAYME_ERR.INSUFFICIENT_PRIV, 'Insufficient privileges');
      return;
   }

   const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
   // Expected format: "Paycom:<PAYME_KEY>"
   const [login, password] = decoded.split(':');
   const expectedKey = process.env.PAYME_KEY ?? '';

   if (login !== 'Paycom' || !expectedKey || password !== expectedKey) {
      logger.warn({ login, path: req.path }, 'payme: invalid credentials');
      rpcDeny(res, rpcId, PAYME_ERR.INSUFFICIENT_PRIV, 'Insufficient privileges');
      return;
   }

   next();
}
