import { Video, KeyRound, Upload } from "lucide-react";

type RecordingMode = "self" | "helper" | "upload";

interface MatchRecordingChoiceProps {
  onSelect: (mode: RecordingMode) => void;
}

const choices: { mode: RecordingMode; icon: typeof Video; title: string; desc: string }[] = [
  {
    mode: "self",
    icon: Video,
    title: "Ich filme selbst",
    desc: "Handy aufstellen und direkt aufnehmen",
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
];

export default function MatchRecordingChoice({ onSelect }: MatchRecordingChoiceProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold font-display">Wie willst du aufnehmen?</h2>
        <p className="text-sm text-muted-foreground mt-1">Wähle eine Option</p>
      </div>

      <div className="space-y-3">
        {choices.map(({ mode, icon: Icon, title, desc }) => (
          <button
            key={mode}
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(20);
              onSelect(mode);
            }}
            className="w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-5 text-left
              transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]
              focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold font-display">{title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
