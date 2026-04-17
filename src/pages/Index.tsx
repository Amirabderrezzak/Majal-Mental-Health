import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Shield, Star, Calendar, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import heroImg from "@/assets/hero-therapy.jpg";

const useFadeUp = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.15 }
    );
    ref.current?.querySelectorAll(".fade-up").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return ref;
};

const Index = () => {
  const containerRef = useFadeUp();
  const { t } = useLanguage();

  return (
    <div ref={containerRef}>
      <Navbar />

      {/* Hero */}
      <section className="bg-teal-hero px-[5%] pt-20 pb-0 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-72px)]">
        <div className="pb-20 lg:pb-20 fade-up">
          <h1 className="font-serif text-primary text-[clamp(42px,5vw,64px)] font-normal leading-[1.1] mb-5">
            {t("hero.title")}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground max-w-[420px] mb-9">
            {t("hero.subtitle")}
          </p>
          <div className="flex gap-3.5 flex-wrap">
            <Link to="/psychologues" className="px-7 py-3.5 rounded-[32px] bg-primary text-primary-foreground font-medium text-[15px] no-underline hover:bg-teal-mid transition-colors">
              {t("hero.cta")}
            </Link>
            <a href="#how" className="px-7 py-3.5 rounded-[32px] bg-card text-primary font-medium text-[15px] no-underline border border-border hover:border-primary transition-colors">
              {t("hero.how")}
            </a>
          </div>
        </div>
        <div className="relative rounded-3xl overflow-hidden h-[340px] lg:h-[520px] self-end fade-up" style={{ transitionDelay: "0.15s" }}>
          <img src={heroImg} alt="Espace thérapeutique Majal" className="w-full h-full object-cover" width={800} height={1024} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 to-primary/65 flex flex-col items-center justify-end pb-10">
            <Heart className="w-14 h-14 text-primary-foreground mb-3" />
            <div className="text-center text-primary-foreground">
              <h3 className="font-serif text-[26px] font-normal">Majal</h3>
              <p className="text-sm opacity-85 mt-1">{t("hero.overlay.subtitle")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-[5%] grid grid-cols-2 lg:grid-cols-4 gap-5 bg-card">
        {[
          { num: "500+", label: t("stats.psychologists") },
          { num: "10k+", label: t("stats.sessions") },
          { num: "95%", label: t("stats.satisfaction") },
          { num: "24/7", label: t("stats.support") },
        ].map((s, i) => (
          <div key={i} className="text-center fade-up" style={{ transitionDelay: `${i * 0.1}s` }}>
            <div className="font-serif text-primary text-[clamp(40px,4vw,56px)] leading-none">{s.num}</div>
            <div className="text-[15px] text-muted-foreground mt-2">{s.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="bg-teal-hero py-20 px-[5%] text-center" id="how">
        <h2 className="font-serif text-primary text-[clamp(30px,3.5vw,44px)] font-normal mb-3 fade-up">{t("how.title")}</h2>
        <p className="text-base text-muted-foreground mb-14 fade-up">{t("how.subtitle")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "🔍", title: t("how.step1.title"), desc: t("how.step1.desc") },
            { icon: "📅", title: t("how.step2.title"), desc: t("how.step2.desc") },
            { icon: "💬", title: t("how.step3.title"), desc: t("how.step3.desc") },
          ].map((c, i) => (
            <div key={i} className="bg-card rounded-lg p-10 text-start shadow-card fade-up" style={{ transitionDelay: `${i * 0.1}s` }}>
              <span className="text-[40px] block mb-5">{c.icon}</span>
              <h3 className="text-[17px] font-semibold text-primary mb-2.5 font-sans">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Majal */}
      <section className="py-20 px-[5%] text-center bg-card" id="why">
        <h2 className="font-serif text-primary text-[clamp(30px,3.5vw,44px)] font-normal mb-3 fade-up">{t("why.title")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-14">
          {[
            { Icon: Shield, title: t("why.1.title"), desc: t("why.1.desc") },
            { Icon: Star, title: t("why.2.title"), desc: t("why.2.desc") },
            { Icon: Calendar, title: t("why.3.title"), desc: t("why.3.desc") },
            { Icon: Heart, title: t("why.4.title"), desc: t("why.4.desc") },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-4 fade-up" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="w-[72px] h-[72px] bg-teal-pale rounded-[18px] flex items-center justify-center">
                <item.Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-primary font-sans">{item.title}</h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-teal-hero py-20 px-[5%] text-center">
        <h2 className="font-serif text-primary text-[clamp(30px,3.5vw,44px)] font-normal mb-3 fade-up">{t("test.title")}</h2>
        <p className="text-base text-muted-foreground mb-14 fade-up">{t("test.subtitle")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { text: t("test.1.text"), author: "Sarah M." },
            { text: t("test.2.text"), author: "Karim B." },
            { text: t("test.3.text"), author: "Leila T." },
          ].map((item, i) => (
            <div key={i} className="bg-card rounded-lg p-8 text-start shadow-card fade-up" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="text-teal-light text-lg tracking-wider mb-4">★★★★★</div>
              <p className="text-[15px] text-foreground leading-relaxed italic mb-5">"{item.text}"</p>
              <div className="text-sm font-semibold text-primary">{item.author}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-teal-cta to-teal-light py-24 px-[5%] text-center">
        <h2 className="font-serif text-primary-foreground text-[clamp(32px,4vw,48px)] font-normal mb-3.5">
          {t("cta.title")}
        </h2>
        <p className="text-[17px] text-primary-foreground/85 mb-10">
          {t("cta.subtitle")}
        </p>
        <Link
          to="/psychologues"
          className="inline-block px-10 py-4 bg-card text-primary font-semibold text-base rounded-[40px] no-underline hover:-translate-y-0.5 hover:shadow-card-hover transition-all"
        >
          {t("cta.button")}
        </Link>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
