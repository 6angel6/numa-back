/**
 * Payme Merchant API — JSON-RPC 2.0 types.
 *
 * Payme calls OUR server. We are the merchant ("billing").
 * Docs: https://developer.help.paycom.uz/initsializatsiya-platezhey/
 */

// ─── RPC envelope ─────────────────────────────────────────────────────────────

export interface PaymeRpcRequest {
   method: PaymeMethod;
   params: Record<string, any>;
   id:     number;
}

export interface PaymeRpcResult {
   result: Record<string, any>;
   id:     number;
}

export interface PaymeRpcError {
   error: {
      code:     number;
      message:  { ru: string; uz: string; en: string };
      data?:    string;
   };
   id: number;
}

export type PaymeRpcResponse = PaymeRpcResult | PaymeRpcError;

// ─── Methods ──────────────────────────────────────────────────────────────────

export type PaymeMethod =
   | 'CheckPerformTransaction'
   | 'CreateTransaction'
   | 'PerformTransaction'
   | 'CancelTransaction'
   | 'CheckTransaction'
   | 'GetStatement';

// ─── Transaction states (Payme spec) ─────────────────────────────────────────

export enum PaymeTxState {
   PENDING   =  1,   // Created, awaiting debit confirmation
   COMPLETED =  2,   // Debit completed — money transferred
   CANCELLED = -1,   // Cancelled while pending
   REFUNDED  = -2,   // Cancelled after completion (refund)
}

// ─── Cancel reasons ───────────────────────────────────────────────────────────

export enum CancelReason {
   RECEIVER_NOT_FOUND = 1,
   DEBIT_ERROR        = 2,
   TRANSACTION_ERROR  = 3,
   TIMEOUT            = 4,   // Auto-cancel after 12 h (43 200 000 ms)
   REFUND             = 5,
   UNKNOWN            = 10,
}

// ─── Error codes ──────────────────────────────────────────────────────────────

export const PAYME_ERR = {
   WRONG_AMOUNT:          -31001,
   TRANSACTION_NOT_FOUND: -31003,
   ORDER_COMPLETED:       -31007,   // Cannot cancel — already fulfilled
   CANNOT_PERFORM:        -31008,   // State machine violation
   ACCOUNT_NOT_FOUND:     -31050,   // Invalid account.order
   PARSE_ERROR:           -32700,
   INVALID_REQUEST:       -32600,
   METHOD_NOT_FOUND:      -32601,
   INSUFFICIENT_PRIV:     -32504,
   SYSTEM_ERROR:          -32400,
} as const;

// ─── Payme-specific data stored in Payment.providerPayload ────────────────────

/**
 * We store Payme timestamps (milliseconds) and cancel reason inside the JSONB
 * providerPayload column so that we don't need a separate migration.
 */
export interface PaymePayload {
   paymeTxTime:   number;          // CreateTransaction.params.time
   performTime?:  number;          // timestamp when PerformTransaction was called
   cancelTime?:   number;          // timestamp when CancelTransaction was called
   cancelReason?: number;          // CancelReason code
}

// ─── Payme checkout URL ───────────────────────────────────────────────────────

/**
 * Generates the Payme hosted checkout redirect URL.
 * Frontend redirects the user here; Payme shows its payment form.
 *
 * Format:  https://checkout.paycom.uz/<base64(params)>
 * Params:  m=MERCHANT_ID;ac.order=ORDER_UUID;a=AMOUNT_TIYIN;l=ru
 */
export function buildPaymeCheckoutUrl(
   merchantId: string,
   orderId:    string,
   amountTiyin: number,
   lang = 'ru',
): string {
   const raw = `m=${merchantId};ac.order=${orderId};a=${amountTiyin};l=${lang}`;
   const encoded = Buffer.from(raw).toString('base64');
   return `https://checkout.paycom.uz/${encoded}`;
}
