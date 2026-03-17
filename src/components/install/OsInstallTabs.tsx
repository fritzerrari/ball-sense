import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Apple, Smartphone, Camera, Shield } from "lucide-react";

interface Step {
  title: string;
  text: string;
}

const iosSteps: Step[] = [
  {
    title: "Safari öffnen",
    text: "Öffne Safari auf deinem iPhone oder iPad. Wichtig: Andere Browser (Chrome, Firefox) unterstützen auf iOS keine PWA-Installation – du musst Safari verwenden.",
  },
  {
    title: "FieldIQ aufrufen",
    text: "Navigiere zur FieldIQ-Adresse, die du von deinem Trainer oder Verein erhalten hast. Melde dich an oder erstelle ein Konto.",
  },
  {
    title: "Teilen-Button tippen",
    text: 'Tippe unten in der Safari-Leiste auf das Teilen-Symbol (Quadrat mit Pfeil nach oben). Scrolle im Menü nach unten und tippe auf „Zum Home-Bildschirm".',
  },
  {
    title: "Bestätigen & fertig",
    text: 'Gib optional einen Namen ein (z. B. „FieldIQ") und tippe auf „Hinzufügen". Die App erscheint jetzt als Icon auf deinem Home-Bildschirm – genau wie eine normale App.',
  },
  {
    title: "Kamera erlauben",
    text: 'Beim ersten Tracking-Start fragt FieldIQ nach Kamera-Zugriff. Tippe auf „Erlauben". Falls abgelehnt: Einstellungen → Safari → Kamera → Erlauben.',
  },
];

const androidSteps: Step[] = [
  {
    title: "Chrome öffnen",
    text: "Öffne Google Chrome auf deinem Android-Smartphone. Andere Chromium-Browser (Edge, Brave) funktionieren ebenfalls.",
  },
  {
    title: "FieldIQ aufrufen",
    text: "Navigiere zur FieldIQ-Adresse. Melde dich an oder erstelle ein Konto.",
  },
  {
    title: "Installieren",
    text: 'Chrome zeigt automatisch ein Banner „App installieren" an. Falls nicht: Tippe auf die drei Punkte (⋮) oben rechts und wähle „App installieren" oder „Zum Startbildschirm hinzufügen".',
  },
  {
    title: "Bestätigen & öffnen",
    text: 'Tippe auf „Installieren". Die App wird heruntergeladen und erscheint auf deinem Startbildschirm und in der App-Übersicht.',
  },
  {
    title: "Kamera erlauben",
    text: 'Beim ersten Tracking-Start fragt FieldIQ nach Kamera-Zugriff. Tippe auf „Zulassen". Falls abgelehnt: Einstellungen → Apps → Chrome → Berechtigungen → Kamera → Erlauben.',
  },
];

function detectOS(): "ios" | "android" {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "android";
}

export function OsInstallTabs() {
  const [defaultTab, setDefaultTab] = useState<"ios" | "android">("android");

  useEffect(() => {
    setDefaultTab(detectOS());
  }, []);

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="ios" className="gap-2">
          <Apple className="h-4 w-4" /> iPhone / iPad
        </TabsTrigger>
        <TabsTrigger value="android" className="gap-2">
          <Smartphone className="h-4 w-4" /> Android
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ios">
        <StepList steps={iosSteps} />
      </TabsContent>
      <TabsContent value="android">
        <StepList steps={androidSteps} />
      </TabsContent>
    </Tabs>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="glass-card p-5 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-bold text-primary">{i + 1}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold font-display">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1 whitespace-pre-line">
                {step.text}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
