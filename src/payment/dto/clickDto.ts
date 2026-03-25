import crypto from 'crypto';

// ─── Request shapes ────────────────────────────────────────────────────────────

/**
 * Click calls POST /payment/click/prepare when a user initiates payment.
 * action = 0
 */
export interface ClickPrepareBody {
   click_trans_id:    number;   // Click's internal transaction ID
   service_id:        number;   // Our service_id from Click merchant dashboard
   click_paydoc_id:   number;   // Click's payment document ID
   merchant_trans_id: string;   // = our Order UUID
   amount:            number;   // Amount in UZS (whole units, NOT tiyin)
   action:            0;
   sign_time:         string;   // 'YYYY-MM-DD HH:mm:SS'
   sign_string:       string;   // MD5 hash — see verifyClickSign()
}

/**
 * Click calls POST /payment/click/complete after the debit succeeds (or fails).
 * action = 1
 */
export interface ClickCompleteBody extends Omit<ClickPrepareBody, 'action'> {
   action:              1;
   /** = payment.id returned by our prepare handler (merchant_confirm_id). */
   merchant_prepare_id: string;
   /** 0 = success. Negative = Click-side error (payment declined, etc.). */
   error:               number;
   error_note:          string;
}

// ─── Response shape ────────────────────────────────────────────────────────────

export interface ClickResponse {
   click_trans_id:      number;
   merchant_trans_id:   string;
   /** = our payment.id. Returned on prepare; echoed back on complete. */
   merchant_confirm_id: string | null;
   error:               number;
   error_note:          string;
}

// ─── Error codes ───────────────────────────────────────────────────────────────

export const CLICK_ERR = {
   SUCCESS:          0,
   SIGN_FAILED:     -1,
   WRONG_AMOUNT:    -2,
   ACTION_NOT_FOUND:-3,
   ALREADY_PAID:    -4,
   ORDER_NOT_FOUND: -5,
   TX_NOT_FOUND:    -6,
   TX_CANCELLED:    -9,
} as const;

export const CLICK_ERR_NOTE: Record<number, string> = {
   0:  'Success',
   [-1]: 'Sign check failed',
   [-2]: 'Incorrect payment amount',
   [-3]: 'Action not found',
   [-4]: 'Already paid',
   [-5]: 'User (order) not found',
   [-6]: 'Transaction not found',
   [-9]: 'Transaction cancelled',
};

// ─── Signature verification ────────────────────────────────────────────────────

/**
 * Verify the MD5 signature sent by Click.
 *
 * Prepare sign input:
 *   click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time
 *
 * Complete sign input:
 *   click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time
 */
export function verifyClickSign(
   body:      ClickPrepareBody | ClickCompleteBody,
   secretKey: string,
): boolean {
   const prepareId = 'merchant_prepare_id' in body
      ? (body as ClickCompleteBody).merchant_prepare_id
      : '';

   const parts: (string | number)[] = [
      body.click_trans_id,
      body.service_id,
      secretKey,
      body.merchant_trans_id,
      ...(prepareId ? [prepareId] : []),
      body.amount,
      body.action,
      body.sign_time,
   ];

   const expected = crypto
      .createHash('md5')
      .update(parts.join(''))
      .digest('hex');

   return expected === body.sign_string;
}

// ─── Checkout URL builder ──────────────────────────────────────────────────────

/**
 * Build the Click hosted-checkout redirect URL.
 * Amount MUST be in UZS (whole units) — Click displays it as-is.
 *
 * Example:
 *   https://my.click.uz/services/pay?service_id=12345&merchant_id=67890
 *     &amount=185000&transaction_param=<orderId>&return_url=https://...
 */
export function buildClickCheckoutUrl(
   serviceId:  string | number,
   merchantId: string | number,
   amountUzs:  number,
   orderId:    string,
   returnUrl?: string,
): string {
   const base   = 'https://my.click.uz/services/pay';
   const params = new URLSearchParams({
      service_id:        String(serviceId),
      merchant_id:       String(merchantId),
      amount:            String(Math.round(amountUzs)),
      transaction_param: orderId,
   });
   if (returnUrl) params.set('return_url', returnUrl);
   return `${base}?${params.toString()}`;
}
