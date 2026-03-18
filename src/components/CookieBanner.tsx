import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "fieldiq_cookie_consent_v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setVisible(!saved);
  }, []);

  const saveConsent = (mode: "essential" | "all") => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, savedAt: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold font-display">Cookie-Einwilligung</p>
          <p className="text-xs text-muted-foreground">
            Wir verwenden essenzielle Cookies für Login und Sicherheit. Optionale Funktionen dürfen erst nach Einwilligung aktiviert werden. Details findest du in der <Link to="/legal/cookie-richtlinie" className="underline underline-offset-4 hover:text-foreground">Cookie-Richtlinie</Link> und <Link to="/legal/datenschutz" className="underline underline-offset-4 hover:text-foreground">Datenschutzerklärung</Link>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => saveConsent("essential")}>Nur essenziell</Button>
          <Button variant="hero" size="sm" onClick={() => saveConsent("all")}>Alle akzeptieren</Button>
        </div>
      </div>
    </div>
  );
}
