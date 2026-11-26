import { useState } from "react";
import { CalendarClock, Check, X, Loader2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtDate, fmtTime } from "@/lib/sessionApi";
import { algiersParts, DAY_KEYS } from "@/lib/availability";

export interface RescheduleRequest {
  id: string;
  booking_id: string;
  patient_id: string;
  proposed_at: string;
  original_booked_at: string;
  message: string | null;
  created_at: string;
  patient_name?: string;
}

interface Props {
  requests: RescheduleRequest[];
  clinicSettings: { startHour: string; endHour: string; workingDays: string[] };
  onRespond: (requestId: string, accept: boolean, note: string) => Promise<void>;
}

const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

/**
 * A patient proposed a time outside the therapist's usual availability. The
 * session stays where it is until the therapist accepts here.
 */
export default function RescheduleRequestsPanel({ requests, clinicSettings, onRespond }: Props) {
  const { t, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-DZ" : "fr-FR";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const outsideHours = (iso: string) => {
    const p = algiersParts(new Date(iso));
    return !clinicSettings.workingDays.includes(DAY_KEYS[p.dow]) || p.minutes < hm(clinicSettings.startHour) || p.minutes + 60 > hm(clinicSettings.endHour);
  };
  const long = (iso: string) => `${fmtDate(iso, locale, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(iso, locale)}`;

  const respond = async (id: string, accept: boolean) => {
    setBusy(`${id}:${accept}`);
    try { await onRespond(id, accept, notes[id] ?? ""); }
    finally { setBusy(null); }
  };

  return (
    <section className="dashboard-card p-5 border-warning/30 bg-warning/5" aria-labelledby="reschedule-requests-title">
      <h3 id="reschedule-requests-title" className="font-serif text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
        <CalendarClock className="w-5 h-5 text-warning" aria-hidden="true" />
        {t("psy.request.title")} ({requests.length})
      </h3>
      <p className="text-xs text-muted-foreground mb-4">{t("psy.request.desc")}</p>
      <div className="space-y-3">
        {requests.map((r) => (
          <article key={r.id} className="rounded-xl border border-border bg-card p-4" aria-label={`${t("psy.request.from")} ${r.patient_name ?? ""}`}>
            <div className="font-semibold text-sm text-foreground">{r.patient_name || t("psy.common.patient")}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through decoration-muted-foreground/50"><bdi>{long(r.original_booked_at)}</bdi></span>
              <ArrowRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
              <span className="font-semibold text-foreground"><bdi>{long(r.proposed_at)}</bdi></span>
              {outsideHours(r.proposed_at) && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">{t("psy.request.outsideHours")}</span>
              )}
            </div>
            {r.message && (
              <blockquote className="mt-2 text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-line">« {r.message} »</blockquote>
            )}
            <label className="block mt-3 text-xs font-semibold text-muted-foreground">
              {t("psy.request.noteLabel")}
              <input
                type="text"
                maxLength={500}
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                placeholder={t("psy.request.notePlaceholder")}
                className="mt-1 w-full px-3 py-2 border border-border/70 rounded-lg text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary font-sans font-normal"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => respond(r.id, true)} disabled={busy !== null}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid disabled:opacity-60">
                {busy === `${r.id}:true` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {t("psy.request.accept")}
              </button>
              <button type="button" onClick={() => respond(r.id, false)} disabled={busy !== null}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold border-none cursor-pointer hover:bg-destructive/15 disabled:opacity-60">
                {busy === `${r.id}:false` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                {t("psy.request.decline")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
