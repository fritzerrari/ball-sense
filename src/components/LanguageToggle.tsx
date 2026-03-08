import { useTranslation, Language } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { language, setLanguage } = useTranslation();

  const toggle = () => {
    setLanguage(language === "de" ? "en" : "de");
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title={language === "de" ? "Switch to English" : "Auf Deutsch wechseln"}
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="uppercase">{language}</span>
    </button>
  );
}
