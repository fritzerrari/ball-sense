import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { extractLogoColors } from "@/lib/extract-logo-colors";
import { Palette, Loader2, RotateCcw, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

export function ClubColorEditor() {
  const { clubId, clubLogoUrl, refreshClubData } = useAuth();
  const [primary, setPrimary] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("primary_color, secondary_color").eq("id", clubId).single().then(({ data }) => {
      if (data) {
        setPrimary(data.primary_color ?? null);
        setSecondary(data.secondary_color ?? null);
      }
      setLoaded(true);
    });
  }, [clubId]);

  const extractFromLogo = async () => {
    if (!clubLogoUrl) {
      toast.error("Bitte zuerst ein Logo hochladen.");
      return;
    }
    setExtracting(true);
    try {
      const colors = await extractLogoColors(clubLogoUrl, 5);
      setSuggested(colors);
      if (colors[0] && !primary) setPrimary(colors[0]);
      if (colors[1] && !secondary) setSecondary(colors[1]);
      if (colors.length === 0) toast.info("Keine markanten Farben im Logo gefunden.");
    } catch {
      toast.error("Farben konnten nicht analysiert werden.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!clubId) return;
    setSaving(true);
    const { error } = await supabase
      .from("clubs")
      .update({ primary_color: primary, secondary_color: secondary })
      .eq("id", clubId);
    setSaving(false);
    if (error) {
      toast.error("Farben konnten nicht gespeichert werden.");
      return;
    }
    await refreshClubData();
    toast.success("Vereinsfarben gespeichert");
  };

  const reset = () => {
    setPrimary(null);
    setSecondary(null);
    setSuggested([]);
  };

  if (!loaded) return <div className="h-32 rounded-xl bg-muted/40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["primary", "secondary"] as const).map((slot) => {
          const value = slot === "primary" ? primary : secondary;
          const setter = slot === "primary" ? setPrimary : setSecondary;
          return (
            <div key={slot} className="rounded-xl border border-border bg-card/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                {slot === "primary" ? "Primärfarbe" : "Sekundärfarbe / Akzent"}
              </p>
              <div className="flex items-center gap-3">
                <label
                  className="relative w-12 h-12 rounded-lg border-2 border-border shadow-sm cursor-pointer overflow-hidden"
                  style={{
                    backgroundColor: value || "transparent",
                    backgroundImage: !value
                      ? "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%)"
                      : undefined,
                    backgroundSize: "10px 10px",
                    backgroundPosition: "0 0, 5px 5px",
                  }}
                >
                  <input
                    type="color"
                    value={value || "#10b981"}
                    onChange={(e) => setter(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => setter(e.target.value || null)}
                    placeholder="#auto"
                    className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm font-mono"
                  />
                  {value && (
                    <button
                      type="button"
                      onClick={() => setter(null)}
                      className="mt-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Zurücksetzen
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {suggested.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-primary" /> Vorschläge aus Logo
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => (!primary ? setPrimary(hex) : setSecondary(hex))}
                className="w-9 h-9 rounded-lg border-2 border-border shadow-sm hover:scale-110 transition-transform"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={extractFromLogo} disabled={extracting || !clubLogoUrl}>
          {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          Aus Logo vorschlagen
        </Button>
        <Button variant="outline" size="sm" onClick={reset} disabled={!primary && !secondary}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Standard wiederherstellen
        </Button>
        <Button variant="hero" size="sm" onClick={handleSave} disabled={saving} className="ml-auto">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Speichern
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tipp: Leere Felder = neutrale Standard-Palette. Änderungen sind nach dem Speichern app-weit sichtbar.
      </p>
    </div>
  );
}
