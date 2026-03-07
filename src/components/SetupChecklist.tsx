import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

interface SetupChecklistProps {
  hasPlayers: boolean;
  hasFields: boolean;
}

export function SetupChecklist({ hasPlayers, hasFields }: SetupChecklistProps) {
  const allDone = hasPlayers && hasFields;
  if (allDone) return null;

  const items = [
    { label: "Verein erstellt", done: true, href: "/settings" },
    { label: "Spieler hinzufügen", done: hasPlayers, href: "/players" },
    { label: "Spielfeld anlegen", done: hasFields, href: "/fields" },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="glass-card p-5 glow-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold font-display">Einrichtung</h3>
        <span className="text-xs text-muted-foreground">{doneCount}/{items.length} erledigt</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.done ? "#" : item.href}
            className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
              item.done
                ? "text-muted-foreground"
                : "hover:bg-muted cursor-pointer"
            }`}
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className={`text-sm flex-1 ${item.done ? "line-through" : "font-medium"}`}>
              {item.label}
            </span>
            {!item.done && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
