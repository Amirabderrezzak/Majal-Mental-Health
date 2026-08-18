import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe, LogIn, UserPlus, LogOut, User, Menu, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const Navbar = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/psychologues", label: t("nav.find") },
    { to: "/mon-espace", label: t("nav.space") },
  ];

  const toggleLang = () => setLang(lang === "fr" ? "ar" : "fr");

  const openMenu = () => {
    setMobileOpen(true);
    setIsAnimating(false);
  };

  const closeMenu = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setMobileOpen(false);
      setIsAnimating(false);
    }, 250);
  };

  const toggleMenu = () => (mobileOpen && !isAnimating ? closeMenu() : openMenu());
  const close = () => (mobileOpen ? closeMenu() : undefined);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 border-b border-border">
      <div className="h-[72px] flex items-center justify-between px-[5%]">
        <Link to="/" className="flex items-center gap-2.5 no-underline" onClick={close}>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl border border-primary/30 text-primary font-semibold">MJ</div>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-9 list-none">
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`no-underline text-[15px] relative transition-colors duration-150 after:absolute after:start-0 after:-bottom-1.5 after:h-0.5 after:w-0 after:bg-primary after:transition-all after:duration-150 hover:text-primary ${
                  pathname === link.to
                    ? "text-primary font-medium after:w-full"
                    : "text-foreground"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-full bg-transparent text-sm text-foreground cursor-pointer hover:bg-teal-pale transition-colors duration-150"
          >
            <Globe className="w-[15px] h-[15px]" />
            {t("nav.langSwitch")}
          </button>

          {user ? (
            <>
              <Link
                to="/mon-espace"
                className="flex items-center gap-1.5 px-5 py-2 border border-primary rounded-full bg-transparent text-sm font-medium text-primary no-underline hover:bg-teal-pale transition-colors duration-150"
              >
                <User className="w-3.5 h-3.5" />
                {t("nav.space")}
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-5 py-2.5 border-none rounded-full bg-primary text-sm font-medium text-primary-foreground cursor-pointer hover:bg-teal-mid transition-colors duration-150"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/connexion"
                className="flex items-center gap-1.5 px-5 py-2 border border-primary rounded-full bg-transparent text-sm font-medium text-primary no-underline hover:bg-teal-pale transition-colors duration-150"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t("nav.login")}
              </Link>
              <Link
                to="/inscription"
                className="flex items-center gap-1.5 px-5 py-2.5 border-none rounded-full bg-primary text-sm font-medium text-primary-foreground no-underline hover:bg-teal-mid transition-colors duration-150"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={toggleMenu}
          className="md:hidden flex items-center justify-center w-10 h-10 bg-transparent border-none cursor-pointer text-foreground"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          ref={menuRef}
          className={`md:hidden border-t border-border bg-card px-[5%] py-4 flex flex-col gap-3 transition-all duration-200 ease-out origin-top ${
            isAnimating
              ? "opacity-0 -translate-y-2 scale-y-95"
              : "opacity-100 translate-y-0 scale-y-100"
          }`}
        >
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={close}
              className={`no-underline text-[15px] py-2.5 px-3 rounded-lg transition-colors duration-150 ${
                pathname === link.to
                  ? "text-primary font-medium bg-teal-pale"
                  : "text-foreground hover:bg-teal-pale"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <hr className="border-border my-1" />

          <button
            onClick={() => { toggleLang(); close(); }}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-border rounded-lg bg-transparent text-sm text-foreground cursor-pointer hover:bg-teal-pale transition-colors duration-150 w-fit"
          >
            <Globe className="w-[15px] h-[15px]" />
            {t("nav.langSwitch")}
          </button>

          {user ? (
            <div className="flex flex-col gap-2.5 mt-1">
              <Link
                to="/mon-espace"
                onClick={close}
                className="flex items-center justify-center gap-1.5 px-5 py-3 border border-primary rounded-full bg-transparent text-sm font-medium text-primary no-underline hover:bg-teal-pale transition-colors duration-150"
              >
                <User className="w-3.5 h-3.5" />
                {t("nav.space")}
              </Link>
              <button
                onClick={() => { signOut(); close(); }}
                className="flex items-center justify-center gap-1.5 px-5 py-3 border-none rounded-full bg-primary text-sm font-medium text-primary-foreground cursor-pointer hover:bg-teal-mid transition-colors duration-150"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-1">
              <Link
                to="/connexion"
                onClick={close}
                className="flex items-center justify-center gap-1.5 px-5 py-3 border border-primary rounded-full bg-transparent text-sm font-medium text-primary no-underline hover:bg-teal-pale transition-colors duration-150"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t("nav.login")}
              </Link>
              <Link
                to="/inscription"
                onClick={close}
                className="flex items-center justify-center gap-1.5 px-5 py-3 border-none rounded-full bg-primary text-sm font-medium text-primary-foreground no-underline hover:bg-teal-mid transition-colors duration-150"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t("nav.signup")}
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
