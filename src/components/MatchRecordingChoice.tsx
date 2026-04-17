import { Video, KeyRound, Upload, MonitorSmartphone } from "lucide-react";
import { isInIframe } from "@/hooks/use-display-capture";

type RecordingMode = "self" | "helper" | "upload" | "external";

interface MatchRecordingChoiceProps {
  onSelect: (mode: RecordingMode) => void;
}

const choices: { mode: RecordingMode; icon: typeof Video; title: string; desc: string; recommended?: boolean; beta?: boolean }[] = [
  {
    mode: "self",
    icon: Video,
    title: "Ich filme selbst",
    desc: "Handy aufstellen und direkt aufnehmen",
    recommended: true,
  },
  {
    mode: "helper",
    icon: KeyRound,
    title: "Helfer filmt",
    desc: "6-stelligen Code an deinen Helfer senden",
  },
  {
    mode: "upload",
    icon: Upload,
    title: "Video hochladen",
    desc: "Bestehendes Video nachträglich analysieren",
  },
  {
    mode: "external",
    icon: MonitorSmartphone,
    title: "Externe Kamera",
    desc: "WiFi-/Rückfahrkamera via App-Bild · Nur Android",
    beta: true,
  },
];

export default function MatchRecordingChoice({ onSelect }: MatchRecordingChoiceProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold font-display">Wie willst du aufnehmen?</h2>
        <p className="text-sm text-muted-foreground mt-1">Wähle eine Option</p>
      </div>

      <div className="space-y-3">
        {choices.map(({ mode, icon: Icon, title, desc, recommended, beta }) => (
          <button
            key={mode}
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(20);
              onSelect(mode);
            }}
            className={`w-full flex items-center gap-4 rounded-xl border-2 bg-card p-5 text-left
              transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97]
              focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                recommended ? "border-primary/30 ring-1 ring-primary/10" : "border-border"
              }`}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold font-display">{title}</p>
                {recommended && (
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Empfohlen</span>
                )}
                {beta && (
                  <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">Beta</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
