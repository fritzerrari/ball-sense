import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useTranslation } from "@/lib/i18n";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Link } from "react-router-dom";

export function PwaInstallPrompt() {
  const { canInstall, dismiss, install, isIos, setShowIosModal, showIosModal } = usePwaInstall();
  const { t } = useTranslation();

  if (!canInstall) return null;

  return (
    <>
      <div className="glass-card glow-border flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("pwa.install")}</p>
            <p className="text-xs text-muted-foreground">
              {isIos ? "Installiere die App direkt auf dem Homescreen für den schnellsten Tracking-Start." : t("pwa.desc")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          <Button variant="hero" size="sm" onClick={() => void install()}>
            <Download className="mr-1 h-4 w-4" />
            {isIos ? "Auf Homescreen" : t("common.install")}
          </Button>
          <Button variant="heroOutline" size="sm" asChild>
            <Link to="/install">Anleitung</Link>
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Installationshinweis schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={showIosModal} onOpenChange={setShowIosModal}>
        <DialogContent className="border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Auf iPhone installieren
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              1. Öffne unten in Safari den <span className="font-medium">Teilen</span>-Button.
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              2. Wähle <span className="font-medium">Zum Home-Bildschirm</span>.
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              3. Bestätige mit <span className="font-medium">Hinzufügen</span>.
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary flex items-start gap-2">
              <Share className="mt-0.5 h-4 w-4 shrink-0" />
              FieldIQ startet danach wie eine echte App direkt vom Homescreen.
            </div>
            <Button variant="heroOutline" className="w-full" asChild>
              <Link to="/install" onClick={() => setShowIosModal(false)}>Ausführliche Anleitung</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
