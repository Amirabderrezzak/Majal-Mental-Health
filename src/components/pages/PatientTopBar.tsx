import { Menu } from "lucide-react";

interface PatientTopBarProps {
  title: string;
  setSidebarOpen: (open: boolean) => void;
}

export default function PatientTopBar({ title, setSidebarOpen }: PatientTopBarProps) {
  return (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/60 px-4 sm:px-6 py-4 flex items-center gap-4 shadow-sm">
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden bg-transparent border-none cursor-pointer text-foreground hover:text-primary transition-colors">
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="font-serif text-xl font-semibold text-foreground leading-none">{title}</h1>
    </div>
  );
}
