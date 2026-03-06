import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const label = MATCH_STATUS_LABELS[status] ?? status;
  const color = MATCH_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {label}
    </span>
  );
}
