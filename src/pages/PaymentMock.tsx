import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DollarSign, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PaymentMock() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const booking_id = params.get("booking_id");
  const amount = params.get("amount");
  const [paying, setPaying] = useState(false);

  const simulatePayment = async () => {
    setPaying(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/payments?action=confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ payment_id: booking_id }),
      });

      if (!res.ok) throw new Error("Webhook failed");

      toast.success(t("pay.success"));
      navigate("/mon-espace");
    } catch (err) {
      toast.error(t("pay.failed"));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[400px] text-center border border-border">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-teal-pale text-primary rounded-full flex items-center justify-center">
            <DollarSign size={32} />
          </div>
        </div>
        <h1 className="text-2xl font-serif text-foreground mb-2">{t("pay.title")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("pay.amountLabel")} <strong className="text-foreground text-xl">{amount} DZD</strong>
        </p>

        <button
          onClick={simulatePayment}
          disabled={paying}
          className="w-full py-4 bg-primary hover:bg-teal-mid text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {paying ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ShieldCheck size={20} />
              {t("pay.payBtn")}
            </>
          )}
        </button>

        <p className="text-xs text-muted-foreground mt-6">
          {t("pay.simNote")}
        </p>
      </div>
    </div>
  );
}
