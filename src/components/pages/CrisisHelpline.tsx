import { PhoneCall } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CrisisHelpline() {
  const { t } = useLanguage();

  return (
    <div className="dashboard-card p-6 border-destructive/30 bg-destructive/10 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-destructive/10 text-destructive shrink-0">
          <PhoneCall className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-base font-semibold text-destructive leading-snug">{t("space.crisis.title")}</h4>
          <p className="text-xs text-destructive/80 mt-1 leading-normal font-sans">{t("space.crisis.desc")}</p>
        </div>
      </div>

      <div className="space-y-2.5 font-sans pt-2 border-t border-destructive/30">
        {[
          { label: "Numéro Vert National (Gendarmerie)", number: "1055" },
          { label: "Protection Civile", number: "14" },
          { label: "Police Secours", number: "1548" },
        ].map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            className="flex items-center justify-between p-3 rounded-xl border border-destructive/30 bg-white hover:bg-destructive/10 transition-all text-destructive no-underline shadow-sm hover:shadow"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-destructive/80 leading-none truncate">{h.label}</div>
              <div className="text-sm font-bold mt-1 text-destructive font-sans leading-none">{h.number}</div>
            </div>
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
