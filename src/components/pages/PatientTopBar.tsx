import { Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PatientTopBarProps {
  title: string;
  setSidebarOpen: (open: boolean) => void;
}

export default function PatientTopBar({ title, setSidebarOpen }: PatientTopBarProps) {
  const { t } = useLanguage();
  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border/60 px-4 sm:px-6 py-4 flex items-center gap-4 shadow-sm">
      <button type="button" onClick={() => setSidebarOpen(true)} aria-label={t("common.openMenu")} className="lg:hidden bg-transparent border-none cursor-pointer text-foreground hover:text-primary transition-colors duration-150 p-2.5 -m-2.5 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="font-serif text-xl font-semibold text-foreground leading-none">{title}</h1>
    </div>
  );
}
