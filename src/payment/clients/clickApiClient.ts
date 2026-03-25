/**
 * Click Merchant Invoice API client.
 * Base: https://api.click.uz/v2/merchant/
 *
 * Used to:
 *   - Create invoices → Click sends an SMS payment request to the user's phone
 *   - Query invoice / payment status
 *   - Cancel (reverse) a successful payment
 *
 * Authentication (all requests except card_token/request):
 *   Header  →  Auth: <merchant_user_id>:<digest>:<timestamp>
 *   digest  →  SHA1(timestamp + secret_key)
 *   timestamp → UNIX seconds (10 digits)
 *
 * Required env vars:
 *   CLICK_SERVICE_ID
 *   CLICK_MERCHANT_USER_ID
 *   CLICK_SECRET_KEY
 */

import crypto from 'crypto';
import logger  from '../../../shared/utils/logger';

const BASE = 'https://api.click.uz/v2/merchant';

// ─── Response types ───────────────────────────────────────────────────────────

export interface ClickInvoiceCreateResponse {
   error_code:  number;
   error_note:  string;
   invoice_id?: number;
}

export interface ClickInvoiceStatusResponse {
   error_code:           number;
   error_note:           string;
   invoice_status?:      number;
   invoice_status_note?: string;
}

export interface ClickPaymentStatusResponse {
   error_code:      number;
   error_note:      string;
   payment_id?:     number;
   payment_status?: number;
   merchant_trans_id?: string;
}

export interface ClickReversalResponse {
   error_code:  number;
   error_note:  string;
   payment_id?: number;
}

// ─── Status code constants ────────────────────────────────────────────────────

/** Invoice lifecycle codes returned by Click. */
export const CLICK_INVOICE_STATUS = {
   PAYMENT_PROCESS: -99,  // being processed / deleted
   NEW:               0,
   PAID:              2,
   CANCELLED:        -1,
   EXPIRED:          -2,
} as const;

/** Payment status codes returned by Click. */
export const CLICK_PAYMENT_STATUS = {
   WAITING:     0,
   SUCCESS:     1,
   CANCELLED:  -1,
} as const;

// ─── Auth header ──────────────────────────────────────────────────────────────

function buildAuthHeader(): string {
   const secretKey      = process.env.CLICK_SECRET_KEY       ?? '';
   const merchantUserId = process.env.CLICK_MERCHANT_USER_ID ?? '';
   const timestamp      = Math.floor(Date.now() / 1000);
   const digest         = crypto
      .createHash('sha1')
      .update(`${timestamp}${secretKey}`)
      .digest('hex');
   return `${merchantUserId}:${digest}:${timestamp}`;
}

function serviceId(): string {
   return process.env.CLICK_SERVICE_ID ?? '';
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function apiRequest<T>(
   method: 'GET' | 'POST' | 'DELETE',
   path:   string,
   body?:  object,
): Promise<T> {
   const url     = `${BASE}${path}`;
   const headers: Record<string, string> = {
      Accept:         'application/json',
      'Content-Type': 'application/json',
      Auth:           buildAuthHeader(),
   };

   const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
   });

   if (!res.ok) {
      throw new Error(`Click API ${method} ${path} returned HTTP ${res.status}`);
   }

   return res.json() as Promise<T>;
}

// ─── Public API methods ───────────────────────────────────────────────────────

/**
 * Create an invoice.
 * Click immediately sends an SMS payment request to `phoneNumber`.
 * Amount must be in **UZS** (whole units, NOT tiyin).
 */
async function createInvoice(
   phoneNumber:     string,
   amountUzs:       number,
   merchantTransId: string,
): Promise<ClickInvoiceCreateResponse> {
   try {
      const result = await apiRequest<ClickInvoiceCreateResponse>('POST', '/invoice/create', {
         service_id:        Number(serviceId()),
         amount:            Math.round(amountUzs),
         // Click expects phone without leading '+': '998901234567' not '+998901234567'
         phone_number:      phoneNumber.replace(/^\+/, ''),
         merchant_trans_id: merchantTransId,
      });
      return result;
   } catch (err) {
      logger.error({ err, merchantTransId }, 'clickApiClient.createInvoice: request failed');
      return { error_code: -1, error_note: 'Click API unreachable' };
   }
}

/**
 * Get the current status of a previously created invoice.
 */
async function getInvoiceStatus(invoiceId: number): Promise<ClickInvoiceStatusResponse> {
   return apiRequest<ClickInvoiceStatusResponse>(
      'GET',
      `/invoice/status/${serviceId()}/${invoiceId}`,
   );
}

/**
 * Get payment status by Click's internal payment_id.
 * The payment_id is the click_trans_id received in our prepare/complete callbacks.
 */
async function getPaymentStatus(paymentId: number): Promise<ClickPaymentStatusResponse> {
   return apiRequest<ClickPaymentStatusResponse>(
      'GET',
      `/payment/status/${serviceId()}/${paymentId}`,
   );
}

/**
 * Get payment status using our own merchant_trans_id (= orderId) and the payment creation date.
 * Useful for checking status before the Click prepare callback has arrived.
 *
 * @param merchantTransId  Our order UUID
 * @param date             ISO date string 'YYYY-MM-DD' (day when payment was initiated)
 */
async function getPaymentStatusByMti(
   merchantTransId: string,
   date:            string,
): Promise<ClickPaymentStatusResponse> {
   return apiRequest<ClickPaymentStatusResponse>(
      'GET',
      `/payment/status_by_mti/${serviceId()}/${merchantTransId}/${date}`,
   );
}

/**
 * Cancel (reverse) a completed payment.
 *
 * Click conditions:
 *   - Payment must have status SUCCESS
 *   - Only payments from the current billing month can be reversed
 *   - Previous-month payments only on the 1st of the next month
 *   - Reversal can be rejected by UZCARD
 *
 * @param paymentId  Click's payment_id (= click_trans_id from callbacks)
 */
async function cancelPayment(paymentId: number): Promise<ClickReversalResponse> {
   return apiRequest<ClickReversalResponse>(
      'DELETE',
      `/payment/reversal/${serviceId()}/${paymentId}`,
   );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const clickApiClient = {
   createInvoice,
   getInvoiceStatus,
   getPaymentStatus,
   getPaymentStatusByMti,
   cancelPayment,
};
