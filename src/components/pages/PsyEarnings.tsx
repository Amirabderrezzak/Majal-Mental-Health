import { useState } from "react";
import { DollarSign, Printer, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  patient_avatar?: string;
  price?: number;
  video_room_url?: string | null;
}

interface PsyEarningsProps {
  earningsThisMonth: number;
  sessionsThisMonth: number;
  pendingPayments: number;
  bookings: Booking[];
  realWeeklyEarnings: { day: string; amount: number }[];
  maxEarning: number;
  profileData: { full_name: string };
}

function ReceiptModal({
  selectedReceiptBooking, setSelectedReceiptBooking, profileData
}: {
  selectedReceiptBooking: Booking | null;
  setSelectedReceiptBooking: (b: Booking | null) => void;
  profileData: { full_name: string };
}) {
  const { t, dir } = useLanguage();
  if (!selectedReceiptBooking) return null;
  const b = selectedReceiptBooking;
  const isRtl = dir === "rtl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-xs transition-opacity" onClick={() => setSelectedReceiptBooking(null)} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in duration-200 flex flex-col justify-between">
        <div id="receipt-print-area" className="space-y-6">
          <div className="flex justify-between items-start border-b border-border/40 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary rounded flex items-center justify-center font-serif text-[10px] text-primary bg-teal-pale/35">MJ</div>
                <span className="text-sm font-serif text-foreground font-semibold">Majal Mental Health</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-sans">Espace de consultation en ligne</p>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-solid border-emerald-100 uppercase tracking-wider font-sans">
              {t("psy.earnings.receipt.statusPaid")}
            </span>
          </div>

          <div className="space-y-1 font-sans">
            <h3 className="text-base font-serif font-bold text-foreground">{t("psy.earnings.receipt.title")}</h3>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs pt-1.5">
              <span className="text-muted-foreground">{t("psy.earnings.receipt.invoiceNum")}</span>
              <span className="font-semibold text-right text-foreground">INV-2026-{b.id.slice(0, 5).toUpperCase()}</span>
              <span className="text-muted-foreground">{t("psy.earnings.receipt.date")}</span>
              <span className="font-semibold text-right text-foreground">{new Date(b.booked_at).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-b border-border/40 py-4 font-sans text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("psy.earnings.receipt.therapist")}</span>
              <span className="font-semibold text-foreground">{profileData.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("psy.earnings.receipt.patient")}</span>
              <span className="font-semibold text-foreground">{b.patient_name}</span>
            </div>
          </div>

          <div className="space-y-3 font-sans text-xs">
            <div className="flex justify-between font-semibold text-muted-foreground pb-1 border-b border-border/30">
              <span>{t("psy.earnings.receipt.desc")}</span>
              <span>Total</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>{t("psy.earnings.receipt.sessionVal")}</span>
              <span className="font-bold">{(b.price || 0).toLocaleString()} DA</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col items-center text-center space-y-2 font-sans relative">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{t("psy.earnings.receipt.signature")}</div>
            <div className="relative w-24 h-24 border-2 border-dashed border-primary/40 rounded-full flex items-center justify-center p-1 overflow-hidden opacity-85 rotate-[-8deg] pointer-events-none select-none my-1">
              <div className="border border-solid border-primary/20 w-full h-full rounded-full flex flex-col items-center justify-center text-[7px] font-bold text-primary tracking-tighter bg-teal-pale/10 leading-none">
                <span>MAJAL CLINIC</span>
                <span className="text-[6px] text-primary/70 my-0.5">ALGERIA</span>
                <span>APPROUVÉ</span>
              </div>
            </div>
            <div className="w-32 border-b border-solid border-muted-foreground/40 font-serif italic text-xs text-muted-foreground pt-1">
              {profileData.full_name.split(" ").slice(-1)[0]}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-solid border-border/40 flex gap-3 mt-4">
          <button onClick={() => setSelectedReceiptBooking(null)} className="px-4 py-3 border border-solid border-border/50 hover:bg-accent/40 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer transition-all">
            {t("psy.common.close")}
          </button>
          <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all flex items-center justify-center gap-1.5 shadow-sm font-sans">
            <Printer className="w-3.5 h-3.5" />
            {t("psy.earnings.receipt.print")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PsyEarnings({
  earningsThisMonth, sessionsThisMonth, pendingPayments,
  bookings, realWeeklyEarnings, maxEarning, profileData
}: PsyEarningsProps) {
  const { t } = useLanguage();
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: t("psy.earnings.thisMonth"),    value: `${earningsThisMonth.toLocaleString()} DA`,                                                              sub: `${sessionsThisMonth} ${t("psy.earnings.sessionsMonth")}` },
          { label: t("psy.earnings.pending"),       value: `${pendingPayments.toLocaleString()} DA`,                                                               sub: `${bookings.filter(b => b.status === "pending").length} ${t("psy.earnings.sessionsPending")}` },
          { label: t("psy.earnings.avgPerSession"), value: sessionsThisMonth > 0 ? `${Math.round(earningsThisMonth / sessionsThisMonth).toLocaleString()} DA` : "—", sub: `${sessionsThisMonth} ${t("psy.earnings.sessionsMonth")}` },
        ].map((c) => (
          <div key={c.label} className="dashboard-card p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</div>
              <div className="font-serif text-3xl text-foreground mt-2 font-bold">{c.value}</div>
            </div>
            <div className="text-xs font-semibold text-primary mt-3 bg-teal-pale/50 px-2.5 py-1 rounded-full self-start border border-primary/5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-card p-6">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.earnings.dailyChart")}</h3>
        <div className="relative h-56 mt-6">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="w-full border-t border-dashed border-border/30" />
            <div className="w-full border-t border-dashed border-border/30" />
            <div className="w-full border-t border-dashed border-border/30" />
            <div className="w-full border-t border-border/60" />
          </div>

          <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
            {realWeeklyEarnings.map((e) => {
              const pct = maxEarning > 0 ? (e.amount / maxEarning) * 100 : 0;
              return (
                <div key={e.day} className="flex-1 h-full flex flex-col justify-end items-center relative group">
                  <span className="absolute -top-7 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-sm z-20 whitespace-nowrap">
                    {e.amount.toLocaleString()} DA
                  </span>
                  <div className="w-7 sm:w-8 bg-primary/10 hover:bg-primary/20 transition-all rounded-t-md relative cursor-pointer"
                    style={{ height: `${pct}%`, minHeight: e.amount > 0 ? "8px" : "4px" }}
                  >
                    {e.amount > 0 && <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-primary rounded-t-md" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-2.5 block">{e.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-5 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.earnings.recentTx")}</h3>
        </div>
        <div className="divide-y divide-border/30">
          {bookings.filter(b => b.status === "confirmed" || b.status === "done").slice(0, 10).map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-teal-hero/25 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{b.patient_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(b.booked_at).toLocaleDateString("fr-FR")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-emerald-600 font-sans">+{(b.price || 0).toLocaleString()} DA</div>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptBooking(b)}
                  className="px-2.5 py-1.5 rounded-lg border border-solid border-emerald-200/50 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-all text-xs font-semibold bg-transparent cursor-pointer font-sans"
                >
                  {t("psy.earnings.receipt.generate")}
                </button>
              </div>
            </div>
          ))}
          {bookings.filter(b => b.status === "confirmed" || b.status === "done").length === 0 && (
            <p className="text-center py-10 text-sm text-muted-foreground font-medium">{t("psy.earnings.noTx")}</p>
          )}
        </div>
      </div>
      <ReceiptModal
        selectedReceiptBooking={selectedReceiptBooking}
        setSelectedReceiptBooking={setSelectedReceiptBooking}
        profileData={profileData}
      />
    </div>
  );
}
