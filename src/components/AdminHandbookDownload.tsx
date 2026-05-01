import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Loader2, FileText, Shield } from "lucide-react";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageOrientation, LevelFormat, TableOfContents, PageBreak,
} from "docx";
import { saveAs } from "file-saver";

type Audience = "user" | "admin";

interface DocRow {
  title: string;
  slug: string;
  content: string;
  category: string;
  audience: string;
  version: string | null;
  sort_order: number;
}

const AUDIENCE_FILTER: Record<Audience, string[]> = {
  user: ["user"],
  admin: ["admin", "dev"],
};

const TITLES: Record<Audience, string> = {
  user: "FieldIQ — Benutzerhandbuch",
  admin: "FieldIQ — Admin- & Technik-Handbuch",
};

/** Convert markdown-ish content into docx Paragraphs */
function contentToParagraphs(text: string): Paragraph[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: Paragraph[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      out.push(new Paragraph({ children: [new TextRun("")] }));
      inList = false;
      continue;
    }
    // Headings
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const map = [HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
      out.push(new Paragraph({
        heading: map[level - 1] ?? HeadingLevel.HEADING_4,
        children: [new TextRun({ text: h[2], bold: true })],
        spacing: { before: 200, after: 120 },
      }));
      inList = false;
      continue;
    }
    // Bullet list
    const b = line.match(/^[-*]\s+(.+)$/);
    if (b) {
      out.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: parseInline(b[1]),
      }));
      inList = true;
      continue;
    }
    // Numbered list
    const n = line.match(/^\d+\.\s+(.+)$/);
    if (n) {
      out.push(new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        children: parseInline(n[1]),
      }));
      inList = true;
      continue;
    }
    out.push(new Paragraph({ children: parseInline(line), spacing: { after: 80 } }));
    inList = false;
  }
  return out;
}

function parseInline(text: string): TextRun[] {
  // Handle **bold** and `code`
  const parts: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(new TextRun(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    else parts.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas" }));
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(new TextRun(text.slice(last)));
  return parts.length ? parts : [new TextRun(text)];
}

async function buildDocx(audience: Audience): Promise<Blob> {
  const { data, error } = await supabase
    .from("documentation")
    .select("title, slug, content, category, audience, version, sort_order")
    .eq("active", true)
    .in("audience", AUDIENCE_FILTER[audience])
    .order("category")
    .order("sort_order");
  if (error) throw error;
  const docs = (data ?? []) as DocRow[];

  // Group by category
  const grouped = new Map<string, DocRow[]>();
  for (const d of docs) {
    if (!grouped.has(d.category)) grouped.set(d.category, []);
    grouped.get(d.category)!.push(d);
  }

  const today = new Date().toLocaleDateString("de-DE");
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: TITLES[audience], bold: true, size: 48 })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Stand: ${today}`, italics: true, color: "666666" })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: audience === "user"
          ? "Anleitung für Trainer und Anwender."
          : "Technische Dokumentation für Administratoren und Entwickler.",
        color: "888888",
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Inhaltsverzeichnis", bold: true })],
    }),
    new Paragraph({
      children: [new TableOfContents("Inhaltsverzeichnis", { hyperlink: true, headingStyleRange: "1-3" })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  for (const [category, items] of grouped) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: category.toUpperCase(), bold: true })],
      spacing: { before: 400, after: 200 },
    }));
    for (const doc of items) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({ text: doc.title, bold: true }),
          ...(doc.version ? [new TextRun({ text: `  (v${doc.version})`, italics: true, color: "888888", size: 18 })] : []),
        ],
        spacing: { before: 200, after: 120 },
      }));
      children.push(...contentToParagraphs(doc.content));
    }
  }

  if (docs.length === 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "Keine Dokumente für diese Zielgruppe gefunden.", italics: true })],
    }));
  }

  const document = new Document({
    creator: "FieldIQ",
    title: TITLES[audience],
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }] },
        { reference: "numbers", levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }] },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(document);
}

export default function AdminHandbookDownload() {
  const [loading, setLoading] = useState<Audience | null>(null);

  const download = async (audience: Audience) => {
    setLoading(audience);
    try {
      const blob = await buildDocx(audience);
      const filename = audience === "user"
        ? `FieldIQ-Benutzerhandbuch-${new Date().toISOString().slice(0, 10)}.docx`
        : `FieldIQ-Admin-Handbuch-${new Date().toISOString().slice(0, 10)}.docx`;
      saveAs(blob, filename);
      toast.success("Handbuch erstellt");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Erstellen");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Handbücher (DOCX)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Generiert tagesaktuell aus der Dokumentations-Datenbank. Neue Features werden automatisch ergänzt.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="hero" size="sm" onClick={() => download("user")} disabled={loading !== null}>
          {loading === "user" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
          Benutzerhandbuch herunterladen
        </Button>
        <Button variant="outline" size="sm" onClick={() => download("admin")} disabled={loading !== null}>
          {loading === "admin" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
          Admin- & Technik-Handbuch herunterladen
        </Button>
      </div>
    </div>
  );
}
