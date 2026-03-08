import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Save, Loader2, ExternalLink, Code,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface LegalDoc {
  id: string;
  slug: string;
  title: string;
  html_content: string;
  active: boolean;
  updated_at: string;
  created_at: string;
}

export default function AdminLegal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editDoc, setEditDoc] = useState<LegalDoc | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [preview, setPreview] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [active, setActive] = useState(true);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["admin_legal_docs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("legal_documents")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as LegalDoc[];
    },
  });

  const openEditor = (doc?: LegalDoc) => {
    if (doc) {
      setSlug(doc.slug);
      setTitle(doc.title);
      setHtmlContent(doc.html_content);
      setActive(doc.active);
      setEditDoc(doc);
      setIsNew(false);
    } else {
      setSlug("");
      setTitle("");
      setHtmlContent("<h1>Titel</h1>\n<p>Inhalt...</p>");
      setActive(true);
      setEditDoc({} as LegalDoc);
      setIsNew(true);
    }
    setPreview(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!slug.trim() || !title.trim()) throw new Error("Slug und Titel sind Pflicht");
      const payload = {
        slug: slug.trim(),
        title: title.trim(),
        html_content: htmlContent,
        active,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };
      if (isNew) {
        const { error } = await supabase.from("legal_documents").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_documents").update(payload).eq("id", editDoc!.id);
        if (error) throw error;
      }
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: isNew ? "legal_doc_created" : "legal_doc_updated",
        entity_type: "legal_document", entity_id: isNew ? slug : editDoc!.id,
        details: { title, slug },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_legal_docs"] });
      setEditDoc(null);
      toast.success(isNew ? "Dokument erstellt" : "Dokument gespeichert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, newActive }: { id: string; newActive: boolean }) => {
      const { error } = await supabase.from("legal_documents").update({ active: newActive, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_legal_docs"] }); toast.success("Status aktualisiert"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_documents").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_email: user?.email,
        action: "legal_doc_deleted", entity_type: "legal_document", entity_id: id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_legal_docs"] });
      setDeleteId(null);
      toast.success("Dokument gelöscht");
    },
  });

  if (isLoading) return <SkeletonCard count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{docs.length} Dokument{docs.length !== 1 ? "e" : ""}</div>
        <Button variant="hero" size="sm" onClick={() => openEditor()}>
          <Plus className="h-4 w-4 mr-1" /> Neues Dokument
        </Button>
      </div>

      <div className="grid gap-3">
        {docs.map((doc) => (
          <div key={doc.id} className="glass-card p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{doc.title}</span>
                {doc.active ? (
                  <Badge variant="default" className="text-[10px]"><Eye className="h-2.5 w-2.5 mr-0.5" />Aktiv</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]"><EyeOff className="h-2.5 w-2.5 mr-0.5" />Inaktiv</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">/legal/{doc.slug}</span>
                <span>Aktualisiert: {format(new Date(doc.updated_at), "dd.MM.yy HH:mm", { locale: de })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Switch
                checked={doc.active}
                onCheckedChange={(val) => toggleActive.mutate({ id: doc.id, newActive: val })}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(doc)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/legal/${doc.slug}`, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(doc.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">
            Keine rechtlichen Dokumente vorhanden. Erstelle dein erstes Dokument.
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editDoc} onOpenChange={() => setEditDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{isNew ? "Neues Dokument" : "Dokument bearbeiten"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Titel *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Datenschutzerklärung" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Slug * (URL-Pfad)</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="datenschutz" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <span className="text-sm">{active ? "Aktiv (öffentlich sichtbar)" : "Inaktiv (versteckt)"}</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">HTML-Inhalt</label>
                <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
                  {preview ? <><Code className="h-3.5 w-3.5 mr-1" />Editor</> : <><Eye className="h-3.5 w-3.5 mr-1" />Vorschau</>}
                </Button>
              </div>
              {preview ? (
                <div
                  className="min-h-[300px] p-4 rounded-lg border border-border bg-background prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              ) : (
                <Textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="min-h-[300px] font-mono text-xs"
                  placeholder="<h1>Titel</h1><p>Inhalt...</p>"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Abbrechen</Button>
            <Button variant="hero" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Dokument löschen"
        description="Dieses Dokument wird unwiderruflich gelöscht."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        variant="destructive"
      />
    </div>
  );
}
