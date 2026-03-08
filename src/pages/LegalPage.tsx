import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

export default function LegalPage() {
  const { slug } = useParams();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["legal_doc", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("title, html_content, updated_at")
        .eq("slug", slug!)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">
              <span className="gradient-text">Field</span>IQ
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !doc && (
          <div className="text-center py-20 space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold font-display">Dokument nicht gefunden</h1>
            <p className="text-muted-foreground text-sm">Dieses Dokument existiert nicht oder ist nicht mehr aktiv.</p>
            <Button variant="outline" asChild>
              <Link to="/">Zur Startseite</Link>
            </Button>
          </div>
        )}

        {doc && (
          <article>
            <h1 className="text-3xl font-bold font-display mb-6">{doc.title}</h1>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: doc.html_content }}
            />
            <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground">
              Zuletzt aktualisiert: {new Date(doc.updated_at).toLocaleDateString("de-DE")}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
