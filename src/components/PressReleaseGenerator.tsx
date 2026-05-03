// PressReleaseGenerator.tsx
// UI to generate, edit, and share AI-written press releases (pre/post match).
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Newspaper,
  Sparkles,
  Loader2,
  Copy,
  Pencil,
  Check,
  Share2,
  Mail,
  Trash2,
  FileDown,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { openWhatsAppShare } from "@/lib/share-whatsapp";

type Tone = "neutral" | "enthusiastic" | "analytical";
type Length = "short" | "medium" | "long";
type Kind = "pre_match" | "post_match";

interface PressRelease {
  id: string;
  match_id: string;
  kind: Kind;
  language: string;
  headline: string;
  lead: string;
  body_html: string;
  quotes: Array<{ author: string; text: string }>;
  tone: Tone;
  length: Length;
  status: "draft" | "approved" | "published";
  manually_edited: boolean;
  generated_at: string;
}

interface Props {
  matchId: string;
  matchStatus: string;
  homeTeam?: string;
  awayTeam?: string;
}

export default function PressReleaseGenerator({ matchId, matchStatus, homeTeam, awayTeam }: Props) {
  const qc = useQueryClient();
  const [activeKind, setActiveKind] = useState<Kind>(matchStatus === "final" ? "post_match" : "pre_match");
  const [tone, setTone] = useState<Tone>("neutral");
  const [length, setLength] = useState<Length>("medium");
  const [quote1, setQuote1] = useState({ author: "Trainer", text: "" });
  const [quote2, setQuote2] = useState({ author: "", text: "" });
  const [generating, setGenerating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<PressRelease>>({});

  const isFinal = matchStatus === "final";

  const { data: releases, isLoading } = useQuery({
    queryKey: ["press_releases", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("press_releases")
        .select("*")
        .eq("match_id", matchId)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as PressRelease[];
    },
  });

  async function handleGenerate() {
    setGenerating(true);
    try {
      const quotes = [quote1, quote2].filter((q) => q.text.trim().length > 5);
      const { data, error } = await supabase.functions.invoke("generate-press-release", {
        body: {
          match_id: matchId,
          kind: activeKind,
          tone,
          length,
          quotes,
          language: "de",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(activeKind === "pre_match" ? "Vorbericht generiert" : "Spielbericht generiert");
      setQuote1({ author: "Trainer", text: "" });
      setQuote2({ author: "", text: "" });
      qc.invalidateQueries({ queryKey: ["press_releases", matchId] });
    } catch (e: any) {
      toast.error("Generierung fehlgeschlagen", { description: e?.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveEdit(release: PressRelease) {
    try {
      const { error } = await supabase
        .from("press_releases")
        .update({
          headline: editFields.headline ?? release.headline,
          lead: editFields.lead ?? release.lead,
          body_html: editFields.body_html ?? release.body_html,
          manually_edited: true,
        })
        .eq("id", release.id);
      if (error) throw error;
      toast.success("Änderungen gespeichert");
      setEditId(null);
      setEditFields({});
      qc.invalidateQueries({ queryKey: ["press_releases", matchId] });
    } catch (e: any) {
      toast.error("Speichern fehlgeschlagen", { description: e?.message });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Diesen Pressetext wirklich löschen?")) return;
    const { error } = await supabase.from("press_releases").delete().eq("id", id);
    if (error) {
      toast.error("Löschen fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Gelöscht");
    qc.invalidateQueries({ queryKey: ["press_releases", matchId] });
  }

  function buildPlainText(r: PressRelease): string {
    const stripHtml = (html: string) =>
      html
        .replace(/<\/(p|h[1-6]|li|ul|ol)>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    const quotesText = (r.quotes ?? []).map((q) => `„${q.text}" – ${q.author}`).join("\n\n");
    return [r.headline, "", r.lead, "", stripHtml(r.body_html), quotesText && "\n" + quotesText]
      .filter(Boolean)
      .join("\n");
  }

  function copyToClipboard(r: PressRelease) {
    navigator.clipboard.writeText(buildPlainText(r));
    toast.success("In Zwischenablage kopiert");
  }

  function shareWhatsApp(r: PressRelease) {
    openWhatsAppShare(`*${r.headline}*\n\n${buildPlainText(r)}`);
  }

  function shareMail(r: PressRelease) {
    const subject = encodeURIComponent(r.headline);
    const body = encodeURIComponent(buildPlainText(r));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function downloadHtml(r: PressRelease) {
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${r.headline}</title>
<style>
  body{font-family:Georgia,serif;max-width:680px;margin:40px auto;padding:24px;color:#1a1a1a;line-height:1.6}
  h1{font-size:28px;margin:0 0 8px;font-weight:700}
  .lead{font-size:18px;font-weight:600;color:#333;margin:0 0 24px}
  .meta{color:#666;font-size:13px;margin-bottom:24px;border-bottom:1px solid #ddd;padding-bottom:12px}
  blockquote{border-left:3px solid #888;padding:8px 16px;margin:16px 0;color:#555;font-style:italic}
  h3{margin-top:24px;font-size:18px}
</style></head><body>
<div class="meta">${r.kind === "pre_match" ? "Vorbericht" : "Spielbericht"} · ${homeTeam ?? ""} ${homeTeam && awayTeam ? "vs." : ""} ${awayTeam ?? ""}</div>
<h1>${r.headline}</h1>
<p class="lead">${r.lead}</p>
${r.body_html}
${(r.quotes ?? []).map((q) => `<blockquote>„${q.text}" – <strong>${q.author}</strong></blockquote>`).join("")}
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pressetext_${r.kind}_${matchId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-5 w-5 text-primary" /> Presse-Bericht generieren
          </CardTitle>
          <CardDescription>
            Vor- oder Nachbericht im Pressetext-Stil – wahlweise mit eigenen Trainer-Zitaten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as Kind)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pre_match">Vorbericht</TabsTrigger>
              <TabsTrigger value="post_match" disabled={!isFinal}>
                Spielbericht {!isFinal && "(nach Spielende)"}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Tonalität</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">Neutral · sachlich</SelectItem>
                  <SelectItem value="enthusiastic">Begeistert · emotional</SelectItem>
                  <SelectItem value="analytical">Analytisch · datenbasiert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Länge</Label>
              <Select value={length} onValueChange={(v) => setLength(v as Length)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Kurz (~300 Wörter)</SelectItem>
                  <SelectItem value="medium">Mittel (~600 Wörter)</SelectItem>
                  <SelectItem value="long">Lang (~1200 Wörter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Trainer-Zitate (optional)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <Input value={quote1.author} onChange={(e) => setQuote1({ ...quote1, author: e.target.value })} placeholder="Trainer" />
                <Input value={quote1.text} onChange={(e) => setQuote1({ ...quote1, text: e.target.value })} placeholder="Zitat 1 …" />
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <Input value={quote2.author} onChange={(e) => setQuote2({ ...quote2, author: e.target.value })} placeholder="Sportl. Leiter" />
                <Input value={quote2.text} onChange={(e) => setQuote2({ ...quote2, text: e.target.value })} placeholder="Zitat 2 (optional) …" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Wenn leer, schlägt die KI 1–2 plausible Zitate vor (klar gekennzeichnet als Vorschlag).
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {activeKind === "pre_match" ? "Vorbericht generieren" : "Spielbericht generieren"}
          </Button>
        </CardContent>
      </Card>

      {/* Generated releases */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Bisher generierte Texte</h3>
        {isLoading && <p className="text-sm text-muted-foreground">Lade …</p>}
        {!isLoading && (releases?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Texte generiert.</p>
        )}

        {releases?.map((r) => {
          const isEditing = editId === r.id;
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={r.kind === "pre_match" ? "secondary" : "default"}>
                        {r.kind === "pre_match" ? "Vorbericht" : "Spielbericht"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{r.tone}</Badge>
                      <Badge variant="outline" className="text-xs">{r.length}</Badge>
                      {r.manually_edited && <Badge variant="outline" className="text-xs gap-1"><Pencil className="h-3 w-3" />bearbeitet</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.generated_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(r)} title="Kopieren">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => shareWhatsApp(r)} title="WhatsApp">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => shareMail(r)} title="E-Mail">
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => downloadHtml(r)} title="HTML download">
                      <FileDown className="h-4 w-4" />
                    </Button>
                    {!isEditing ? (
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setEditFields({}); }} title="Bearbeiten">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(r)} title="Speichern">
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)} title="Löschen">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <Input
                        value={editFields.headline ?? r.headline}
                        onChange={(e) => setEditFields({ ...editFields, headline: e.target.value })}
                        className="font-bold text-lg"
                      />
                      <Textarea
                        value={editFields.lead ?? r.lead}
                        onChange={(e) => setEditFields({ ...editFields, lead: e.target.value })}
                        rows={2}
                        className="font-medium"
                      />
                      <Textarea
                        value={editFields.body_html ?? r.body_html}
                        onChange={(e) => setEditFields({ ...editFields, body_html: e.target.value })}
                        rows={12}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">HTML wird im Vorschau-Modus gerendert.</p>
                    </>
                  ) : (
                    <>
                      <h2 className="font-display text-xl font-bold leading-tight">{r.headline}</h2>
                      <p className="font-medium text-foreground">{r.lead}</p>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: r.body_html }}
                      />
                      {(r.quotes ?? []).length > 0 && (
                        <div className="space-y-2 border-l-2 border-primary/40 pl-3">
                          {r.quotes.map((q, i) => (
                            <p key={i} className="text-sm italic text-muted-foreground">
                              „{q.text}" <span className="font-medium text-foreground">– {q.author}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
