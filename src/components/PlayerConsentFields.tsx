import { ConsentStatusBadge, getConsentHint } from "@/components/ConsentStatusBadge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrackingConsentStatus } from "@/lib/types";

interface PlayerConsentFieldsProps {
  status: TrackingConsentStatus;
  notes: string;
  updatedAt?: string | null;
  disabled?: boolean;
  onStatusChange: (status: TrackingConsentStatus) => void;
  onNotesChange: (notes: string) => void;
}

export function PlayerConsentFields({
  status,
  notes,
  updatedAt,
  disabled,
  onStatusChange,
  onNotesChange,
}: PlayerConsentFieldsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Tracking-Einwilligung</p>
          <p className="text-xs text-muted-foreground">
            Status pflegen und einen Hinweis direkt am Spieler hinterlegen.
          </p>
        </div>
        <ConsentStatusBadge status={status} />
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Status</label>
          <Select
            value={status}
            onValueChange={(value) => onStatusChange(value as TrackingConsentStatus)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Offen</SelectItem>
              <SelectItem value="granted">Liegt vor</SelectItem>
              <SelectItem value="denied">Abgelehnt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Hinweis / Notiz</label>
          <Textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="z. B. Schriftliche Einwilligung liegt vor / Rückfrage mit Eltern offen"
            className="min-h-[110px] bg-background"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{getConsentHint(status)}</p>
        {updatedAt ? (
          <p>Zuletzt aktualisiert: {new Date(updatedAt).toLocaleString("de-DE")}</p>
        ) : (
          <p>Noch keine Aktualisierung dokumentiert.</p>
        )}
      </div>
    </div>
  );
}
