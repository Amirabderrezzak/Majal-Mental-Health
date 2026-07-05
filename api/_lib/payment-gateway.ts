export interface CheckoutParams {
  booking_id: string;
  amount: number;
  full_name: string;
  phone: string;
  email: string;
  memo?: string;
}

export interface CheckoutResult {
  transaction_id: string;
  payment_url: string;
  amount: number;
  status: string;
}

export interface PaymentGateway {
  createCheckout(params: CheckoutParams, returnUrl: string): Promise<CheckoutResult>;
}

const SOFIZPAY_API = "https://sofizpay.com/services/operation_post";

class SofizPayGateway implements PaymentGateway {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async createCheckout(params: CheckoutParams, returnUrl: string): Promise<CheckoutResult> {
    const response = await fetch(SOFIZPAY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypted_sk: this.secretKey,
        amount: params.amount,
        full_name: params.full_name,
        phone: params.phone,
        email: params.email,
        return_url: returnUrl,
        memo: params.memo || params.booking_id,
        redirect: "yes",
        keep_return_url: "True",
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "SofizPay transaction creation failed");
    }

    return {
      transaction_id: data.transaction_id,
      payment_url: data.payment_url,
      amount: parseFloat(data.amount),
      status: data.status,
    };
  }
}

class MockGateway implements PaymentGateway {
  async createCheckout(params: CheckoutParams, returnUrl: string): Promise<CheckoutResult> {
    return {
      transaction_id: `mock_${Date.now()}`,
      payment_url: `${returnUrl}?booking_id=${params.booking_id}&amount=${params.amount}&mock=true`,
      amount: params.amount,
      status: "pending_user_transfer_start",
    };
  }
}

export function getPaymentGateway(): PaymentGateway {
  const secretKey = process.env.SOFIZPAY_SECRET_KEY;
  if (secretKey) {
    return new SofizPayGateway(secretKey);
  }
  console.warn("SOFIZPAY_SECRET_KEY not set — using mock payment gateway");
  return new MockGateway();
}
