import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Link } from "react-router-dom";

export function MobileInstallFab() {
  const { canInstall, dismiss, install, isIos, setShowIosModal, showIosModal } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex items-center gap-2 md:hidden">
        <button
          onClick={dismiss}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          aria-label="Installationshinweis schließen"
        >
          <X className="h-4 w-4" />
        </button>
        <Button variant="hero" size="lg" className="rounded-full px-5 shadow-lg" onClick={() => void install()}>
          <Download className="mr-2 h-5 w-5" />
          {isIos ? "App sichern" : "App laden"}
        </Button>
      </div>

      <Dialog open={showIosModal} onOpenChange={setShowIosModal}>
        <DialogContent className="border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Auf iPhone installieren
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">1. Safari öffnen und unten auf <span className="font-medium">Teilen</span> tippen.</div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">2. <span className="font-medium">Zum Home-Bildschirm</span> auswählen.</div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">3. Mit <span className="font-medium">Hinzufügen</span> bestätigen.</div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary flex items-start gap-2">
              <Share className="mt-0.5 h-4 w-4 shrink-0" />
              So startet FieldIQ später ohne Browserleisten und deutlich schneller.
            </div>
            <Button variant="heroOutline" className="w-full" asChild>
              <Link to="/install" onClick={() => setShowIosModal(false)}>Anleitung öffnen</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
