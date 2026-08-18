import { useState, useEffect } from "react";
import { Wind, Play, Square, Check, Heart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CopingPage() {
  const { t, lang } = useLanguage();
  const [breathActive, setBreathActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
  const [breathTimer, setBreathTimer] = useState(4);
  const [groundingStep, setGroundingStep] = useState(0);

  useEffect(() => {
    let interval: any;
    if (breathActive) {
      interval = setInterval(() => {
        setBreathTimer((prev) => {
          if (prev === 1) {
            setBreathPhase((phase) => {
              if (phase === "inhale") return "hold1";
              if (phase === "hold1") return "exhale";
              if (phase === "exhale") return "hold2";
              return "inhale";
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setBreathTimer(4);
      setBreathPhase("inhale");
    }
    return () => clearInterval(interval);
  }, [breathActive]);

  const getBreathInstructions = () => {
    if (breathPhase === "inhale") return { text: t("space.coping.breath.inhale"), scale: 1.6, color: "bg-teal-pale text-teal-800 border-teal-300" };
    if (breathPhase === "hold1") return { text: t("space.coping.breath.hold"), scale: 1.6, color: "bg-amber-100 text-amber-800 border-amber-300" };
    if (breathPhase === "exhale") return { text: t("space.coping.breath.exhale"), scale: 1.0, color: "bg-teal-pale text-primary border-primary/25" };
    return { text: t("space.coping.breath.hold"), scale: 1.0, color: "bg-amber-100 text-amber-800 border-amber-300" };
  };

  const breathInfo = getBreathInstructions();

  const groundingSteps = [
    { num: 5, sense: "👀 Vue", desc: "Regardez autour de vous et nommez 5 choses que vous pouvez voir.", descAr: "انظر حولك وسمِّ 5 أشياء يمكنك رؤيتها." },
    { num: 4, sense: "🤝 Toucher", desc: "Portez attention à votre corps et nommez 4 choses que vous pouvez toucher ou sentir physiquement.", descAr: "انتبه إلى جسدك وسمِّ 4 أشياء يمكنك لمسها أو الشعور بها جسديًا." },
    { num: 3, sense: "👂 Ouïe", desc: "Écoutez attentivement et identifiez 3 bruits distincts autour de vous.", descAr: "استمع جيداً وحدد 3 أصوات مختلفة من حولك." },
    { num: 2, sense: "👃 Odorat", desc: "Respirez doucement et identifiez 2 odeurs différentes dans votre environnement.", descAr: "تنفس ببطء وحدد رائحتين مختلفتين في محيطك." },
    { num: 1, sense: "👅 Goût", desc: "Prenez conscience d'une chose que vous pouvez goûter, ou concentrez-vous sur la sensation dans votre bouche.", descAr: "كن على دراية بشيء واحد يمكنك تذوقه، أو ركز على الإحساس في فمك." }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-4xl animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <div className="dashboard-card p-6 md:p-8 flex flex-col justify-between items-center text-center h-[500px]">
          <div className="w-full">
            <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.coping.breathing")}</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">{t("space.coping.breathingDesc")}</p>
          </div>

          <div className="relative w-48 h-48 flex items-center justify-center my-6">
            <div 
              className="absolute inset-0 rounded-full border border-solid border-primary/20 bg-teal-pale/5 opacity-40 transition-all duration-[1000ms] ease-in-out" 
              style={{ transform: `scale(${breathActive ? breathInfo.scale * 1.15 : 1.0})` }}
            />
            <div 
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-4 border-solid ${breathInfo.color} shadow-lg transition-all duration-[1000ms] ease-in-out`}
              style={{ transform: `scale(${breathActive ? breathInfo.scale : 1.0})` }}
            >
              {breathActive ? (
                <>
                  <span className="text-lg font-serif font-bold tracking-wide animate-pulse">{breathInfo.text}</span>
                  <span className="text-2xl font-bold mt-1.5 font-sans">{breathTimer}s</span>
                </>
              ) : (
                <Wind className="w-12 h-12 text-primary" />
              )}
            </div>
          </div>

          <button
            onClick={() => setBreathActive(!breathActive)}
            className={`w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 ${
              breathActive 
                ? "bg-red-50 text-red-600 hover:bg-red-100" 
                : "bg-primary text-primary-foreground hover:bg-teal-mid"
            }`}
          >
            {breathActive ? (
              <>
                <Square className="w-4 h-4" />
                {t("space.coping.breath.stop")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {t("space.coping.breath.start")}
              </>
            )}
          </button>
        </div>

        <div className="dashboard-card p-6 md:p-8 flex flex-col justify-between h-[500px]">
          <div className="w-full">
            <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.coping.grounding")}</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t("space.coping.groundingDesc")}</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-6">
            {groundingStep === 0 && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-teal-pale flex items-center justify-center mx-auto border border-solid border-primary/10">
                  <Heart className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Prêt pour l'ancrage ?</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Cet exercice vous aide à vous reconnecter au moment présent lorsque votre esprit s'emballe ou s'inquiète.
                </p>
              </div>
            )}

            {groundingStep > 0 && groundingStep <= 5 && (() => {
              const step = groundingSteps[groundingStep - 1];
              return (
                <div className="text-center space-y-5 animate-in fade-in duration-300">
                  <div className="w-20 h-20 rounded-full bg-teal-pale border-2 border-solid border-primary/10 flex items-center justify-center mx-auto text-3xl font-serif font-bold text-primary shadow-inner">
                    {step.num}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-primary uppercase tracking-widest">{step.sense}</div>
                    <p className="text-sm font-semibold text-foreground px-4 leading-relaxed font-sans">{lang === "ar" ? step.descAr : step.desc}</p>
                  </div>
                </div>
              );
            })()}

            {groundingStep === 6 && (
              <div className="text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 rounded-full bg-teal-pale border border-solid border-border flex items-center justify-center mx-auto text-primary shadow-md">
                  <Check className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold text-foreground">Exercice terminé !</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Prenez une grande respiration lente. Vous avez fait un pas important pour prendre soin de vous.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {groundingStep > 0 && (
              <button
                onClick={() => setGroundingStep((prev) => prev - 1)}
                className="px-4 py-3 border border-solid border-border/50 hover:bg-accent/40 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer transition-all"
              >
                Retour
              </button>
            )}
            <button
              onClick={() => {
                if (groundingStep === 6) {
                  setGroundingStep(0);
                } else {
                  setGroundingStep((prev) => prev + 1);
                }
              }}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all text-center"
            >
              {groundingStep === 0 ? "Commencer" : groundingStep === 5 ? "Terminer" : groundingStep === 6 ? "Recommencer" : "Suivant"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
