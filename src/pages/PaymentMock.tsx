import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DollarSign, ShieldCheck } from "lucide-react";

export default function PaymentMock() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const booking_id = params.get("booking_id");
  const amount = params.get("amount");
  const [paying, setPaying] = useState(false);

  const simulatePayment = async () => {
    setPaying(true);
    // Simulate Gateway processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      // Send webhook to our backend from the "gateway"
      const res = await fetch("http://localhost:3001/api/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id,
          status: "paid",
        }),
      });

      if (!res.ok) throw new Error("Webhook failed");

      toast.success("Paiement réussi ! Réservation confirmée.");
      navigate("/mon-espace"); // Replace with a success URL route
    } catch (err) {
      toast.error("Échec de la simulation de paiement");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[400px] text-center border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
            <DollarSign size={32} />
          </div>
        </div>
        <h1 className="text-2xl font-serif text-slate-900 mb-2">Paiement Sécurisé</h1>
        <p className="text-slate-500 mb-8">
          Montant à régler : <strong className="text-slate-800 text-xl">{amount} DZD</strong>
        </p>

        <button
          onClick={simulatePayment}
          disabled={paying}
          className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {paying ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ShieldCheck size={20} />
              Payer maintenant
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 mt-6">
          Il s'agit d'une simulation de paiement. En production, ceci sera remplacé par Sofizpay ou CIB/Edahabia.
        </p>
      </div>
    </div>
  );
}
