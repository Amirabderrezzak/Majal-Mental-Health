import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";

type Status = "processing" | "success" | "cancelled" | "error";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const payment_id = params.get("payment_id");
    const mock = params.get("mock");
    const mockStatus = params.get("status");

    if (!payment_id) {
      setStatus("error");
      setErrorMsg("Aucune référence de paiement trouvée.");
      return;
    }

    if (mock === "true" && mockStatus === "success") {
      confirmPayment(payment_id, true);
    } else if (mock === "true" && mockStatus === "cancelled") {
      setStatus("cancelled");
    } else {
      confirmPayment(payment_id, false);
    }
  }, []);

  const confirmPayment = async (payment_id: string, isMock: boolean) => {
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id, mock: isMock ? "true" : undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error === "Payment not confirmed") {
          setStatus("error");
          setErrorMsg("Le paiement n'a pas pu être confirmé. Veuillez réessayer.");
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Erreur lors de la confirmation.");
        }
        return;
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Erreur de connexion lors de la confirmation du paiement.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-hero to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 sm:p-10 text-center border border-border/40 animate-in fade-in zoom-in-95 duration-300">
        {status === "processing" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-teal-pale flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h1 className="font-serif text-2xl text-foreground mb-2">Confirmation en cours...</h1>
            <p className="text-sm text-muted-foreground">Veuillez patienter pendant que nous confirmons votre paiement.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-6 border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="font-serif text-2xl text-foreground mb-2">Paiement réussi !</h1>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Votre séance a été confirmée. Vous recevrez un email de confirmation avec tous les détails.
            </p>
            <Link
              to="/mon-espace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid transition-all active:scale-95"
            >
              Voir mes réservations <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6 border border-amber-100">
              <XCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="font-serif text-2xl text-foreground mb-2">Paiement annulé</h1>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Vous avez annulé le paiement. Aucun montant n'a été débité. Vous pouvez réessayer quand vous voulez.
            </p>
            <Link
              to="/psychologues"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid transition-all active:scale-95"
            >
              Retour aux psychologues <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6 border border-red-100">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="font-serif text-2xl text-foreground mb-2">Erreur</h1>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{errorMsg || "Une erreur est survenue lors du traitement."}</p>
            <Link
              to="/mon-espace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid transition-all active:scale-95"
            >
              Retour à mon espace <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
