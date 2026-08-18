import { PhoneCall } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CrisisHelpline() {
  const { t } = useLanguage();

  return (
    <div className="dashboard-card p-6 border-red-200/50 bg-red-50/40 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-red-100/70 text-red-600 shrink-0">
          <PhoneCall className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-base font-semibold text-red-900 leading-snug">{t("space.crisis.title")}</h4>
          <p className="text-xs text-red-800/80 mt-1 leading-normal font-sans">{t("space.crisis.desc")}</p>
        </div>
      </div>

      <div className="space-y-2.5 font-sans pt-2 border-t border-red-200/40">
        {[
          { label: "Numéro Vert National (Gendarmerie)", number: "1055" },
          { label: "Protection Civile", number: "14" },
          { label: "Police Secours", number: "1548" },
        ].map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            className="flex items-center justify-between p-3 rounded-xl border border-red-200/40 bg-white hover:bg-red-50/40 transition-all text-red-950 no-underline shadow-sm hover:shadow"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-red-800/80 leading-none truncate">{h.label}</div>
              <div className="text-sm font-bold mt-1 text-red-950 font-sans leading-none">{h.number}</div>
            </div>
            <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
