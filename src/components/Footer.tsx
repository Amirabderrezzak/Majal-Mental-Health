import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-teal-footer text-primary-foreground/75 px-[5%] pt-[60px] pb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_1fr] gap-10 mb-12">
        <div>
          <h3 className="font-serif text-2xl text-primary-foreground mb-2.5">Majal</h3>
          <p className="text-sm leading-relaxed">{t("footer.tagline")}</p>
        </div>
        <div>
          <h4 className="text-[15px] font-semibold text-primary-foreground mb-4">{t("footer.nav")}</h4>
          <Link to="/"             className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("nav.home")}</Link>
          <Link to="/psychologues" className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("nav.find")}</Link>
          <Link to="/mon-espace"   className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("nav.space")}</Link>
        </div>
        <div>
          <h4 className="text-[15px] font-semibold text-primary-foreground mb-4">{t("footer.support")}</h4>
          <Link to="/aide"    className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("footer.help")}</Link>
          <Link to="/contact" className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("footer.contact")}</Link>
          <Link to="/faq"     className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("footer.faq")}</Link>
        </div>
        <div>
          <h4 className="text-[15px] font-semibold text-primary-foreground mb-4">{t("footer.legal")}</h4>
          <Link to="/confidentialite" className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("footer.privacy")}</Link>
          <Link to="/conditions"      className="block text-sm text-primary-foreground/65 no-underline mb-2.5 hover:text-primary-foreground">{t("footer.terms")}</Link>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 pt-6 text-center text-[13px] text-primary-foreground/45">
        {t("footer.rights")}
      </div>
    </footer>
  );
};

export default Footer;
