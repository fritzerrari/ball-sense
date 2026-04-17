import { Video, KeyRound, Upload, MonitorSmartphone } from "lucide-react";
import { isInIframe, isMobileBrowser } from "@/hooks/use-display-capture";

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
    desc: "WiFi-/Rückfahrkamera via Bildschirm-Freigabe · Nur Desktop-Browser",
    beta: true,
  },
];

export default function MatchRecordingChoice({ onSelect }: MatchRecordingChoiceProps) {
  const inFrame = isInIframe();
  const mobile = isMobileBrowser();

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold font-display">Wie willst du aufnehmen?</h2>
        <p className="text-sm text-muted-foreground mt-1">Wähle eine Option</p>
      </div>

      <div className="space-y-3">
        {choices.map(({ mode, icon: Icon, title, desc, recommended, beta }) => {
          const liveOnly = mode === "external" && inFrame && !mobile;
          const mobileBlocked = mode === "external" && mobile;
          const disabled = mobileBlocked;
          return (
            <button
              key={mode}
              onClick={() => {
                if (disabled) return;
                if (navigator.vibrate) navigator.vibrate(20);
                onSelect(mode);
              }}
              disabled={disabled}
              aria-disabled={disabled}
              className={`w-full flex items-center gap-4 rounded-xl border-2 bg-card p-5 text-left
                transition-all focus:outline-none focus:ring-2 focus:ring-primary/50
                ${disabled
                  ? "opacity-60 cursor-not-allowed border-border"
                  : "hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97]"}
                ${recommended ? "border-primary/30 ring-1 ring-primary/10" : "border-border"}`}
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
                  {beta && !mobileBlocked && (
                    <span className="text-[10px] font-semibold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">Desktop Beta</span>
                  )}
                  {liveOnly && (
                    <span className="text-[10px] font-semibold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">Nur Live-URL</span>
                  )}
                  {mobileBlocked && (
                    <span className="text-[10px] font-semibold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">Im mobilen Browser nicht möglich</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {mobileBlocked
                    ? "Bitte am Desktop nutzen — oder hier eine der anderen Optionen wählen."
                    : desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
