export interface CheckoutParams {
  payment_id: string;
  amount: number;
  full_name: string;
  phone: string;
  email: string;
  memo?: string;
}

export interface CheckoutResult {
  transaction_id: string;
  payment_url: string;
  cib_transaction_id: string;
  amount: number;
  status: string;
}

export interface PaymentGateway {
  createCheckout(params: CheckoutParams, returnUrl: string): Promise<CheckoutResult>;
  checkStatus(cibTransactionId: string): Promise<{ status: string; success: boolean; failed: boolean }>;
}

const SANDBOX_BASE = "https://sofizpay.com/sandbox";
const PROD_BASE = "https://www.sofizpay.com";

class SofizPayGateway implements PaymentGateway {
  private publicKey: string;
  private isSandbox: boolean;

  constructor(publicKey: string, isSandbox = false) {
    this.publicKey = publicKey;
    this.isSandbox = isSandbox;
  }

  async createCheckout(params: CheckoutParams, returnUrl: string): Promise<CheckoutResult> {
    const base = this.isSandbox ? SANDBOX_BASE : PROD_BASE;
    const url = new URL(`${base}/make-cib-transaction/`);

    url.searchParams.set("account", this.publicKey);
    url.searchParams.set("amount", String(params.amount));
    url.searchParams.set("full_name", params.full_name);
    url.searchParams.set("phone", params.phone);
    url.searchParams.set("email", params.email);
    url.searchParams.set("return_url", returnUrl);
    url.searchParams.set("memo", params.memo || params.payment_id);
    url.searchParams.set("redirect", "no");
    url.searchParams.set("keep_return_url", "True");

    console.log(`SofizPay CIB request: amount=${params.amount}`);

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
      },
    });

    const text = await response.text();

    let data: any;
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    if (!response.ok || data.status === "error") {
      throw new Error(data.message || `SofizPay API error: ${response.status}`);
    }

    return {
      transaction_id: data.transaction_id || "",
      payment_url: data.payment_url,
      cib_transaction_id: data.cib_transaction_id || "",
      amount: parseFloat(data.amount) || params.amount,
      status: data.status || "pending_user_transfer_start",
    };
  }

  async checkStatus(cibTransactionId: string): Promise<{ status: string; success: boolean; failed: boolean }> {
    const base = this.isSandbox ? SANDBOX_BASE : PROD_BASE;
    const url = new URL(`${base}/cib-transaction-check/`);
    url.searchParams.set("order_number", cibTransactionId);

    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
      return { status: "error", success: false, failed: false };
    }

    // SofizPay returns a numeric orderStatus (2 = paid) and errorCode (0 = ok).
    // CIB capture is asynchronous: "pending" must NOT be treated as paid.
    const orderStatus = Number(data.orderStatus ?? data.order_status ?? data.status);
    const errorCode = Number(data.errorCode ?? data.error_code ?? 0);

    const isPaid = orderStatus === 2 && errorCode === 0;
    const isFailed =
      orderStatus === 0 ||
      errorCode !== 0 ||
      data.status === "failed" ||
      data.status === "cancelled" ||
      data.status === "expired";

    return {
      status: isPaid ? "success" : isFailed ? "failed" : "pending",
      success: isPaid,
      failed: isFailed,
    };
  }
}

class MockGateway implements PaymentGateway {
  async createCheckout(params: CheckoutParams, returnUrl: string): Promise<CheckoutResult> {
    return {
      transaction_id: `mock_${Date.now()}`,
      payment_url: `${returnUrl}?payment_id=${params.payment_id}&mock=true&status=success`,
      cib_transaction_id: `mock_cib_${Date.now()}`,
      amount: params.amount,
      status: "success",
    };
  }

  async checkStatus(_cibTransactionId: string): Promise<{ status: string; success: boolean; failed: boolean }> {
    return { status: "success", success: true, failed: false };
  }
}

export function getPaymentGateway(): PaymentGateway {
  const publicKey = process.env.SOFIZPAY_PUBLIC_KEY;
  const sandbox = process.env.SOFIZPAY_SANDBOX === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (publicKey) {
    console.log(`SofizPay gateway: ${sandbox ? "SANDBOX" : "PRODUCTION"} mode`);
    return new SofizPayGateway(publicKey, sandbox);
  }

  // PRODUCTION GATE: the mock gateway lets anyone "pay" for free (its webhook/
  // confirm marks bookings confirmed with no real transaction). It must NEVER be
  // usable in production. In prod without a real key we fail closed so a free
  // mock confirmation is impossible; the mock is only a dev convenience.
  if (isProduction) {
    throw new Error("Payment gateway not configured");
  }

  console.warn("SOFIZPAY_PUBLIC_KEY not set — using mock payment gateway (development only)");
  return new MockGateway();
}
