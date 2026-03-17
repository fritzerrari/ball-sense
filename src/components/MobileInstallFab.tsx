import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router-dom";

export function MobileInstallFab() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") setDismissed(true);
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosModal(true);
    }
  };

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden flex items-center gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleInstall}
          className="h-14 px-5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center gap-2 font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
        >
          <Download className="h-5 w-5" />
          App installieren
        </button>
      </div>

      {/* iOS Modal */}
      <Dialog open={showIosModal} onOpenChange={setShowIosModal}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Auf iPhone installieren
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-sm font-medium">Teilen-Button antippen</p>
                <p className="text-xs text-muted-foreground">Das □↑ Symbol unten in Safari</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-sm font-medium">„Zum Home-Bildschirm"</p>
                <p className="text-xs text-muted-foreground">Nach unten scrollen und antippen</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-sm font-medium">„Hinzufügen" bestätigen</p>
                <p className="text-xs text-muted-foreground">FieldIQ erscheint auf deinem Home-Screen</p>
              </div>
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
