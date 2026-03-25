import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X, Minus, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { Footer } from "@/components/landing/Footer";

type CellType = "check" | "x" | "limited" | "text";

interface CompareRow {
  labelKey: string;
  fiq: { type: CellType; textKey?: string };
  gps: { type: CellType; textKey?: string };
  cam: { type: CellType; textKey?: string };
  manual: { type: CellType; textKey?: string };
}

const rows: CompareRow[] = [
  {
    labelKey: "compare.monthlyCost",
    fiq: { type: "text", textKey: "compare.fiq.cost" },
    gps: { type: "text", textKey: "compare.gps.cost" },
    cam: { type: "text", textKey: "compare.cam.cost" },
    manual: { type: "text", textKey: "compare.manual.cost" },
  },
  {
    labelKey: "compare.hardwareInvestment",
    fiq: { type: "text", textKey: "compare.fiq.hardware" },
    gps: { type: "text", textKey: "compare.gps.hardware" },
    cam: { type: "text", textKey: "compare.cam.hardware" },
    manual: { type: "text", textKey: "compare.manual.hardware" },
  },
  {
    labelKey: "compare.setupEffort",
    fiq: { type: "text", textKey: "compare.fiq.setup" },
    gps: { type: "text", textKey: "compare.gps.setup" },
    cam: { type: "text", textKey: "compare.cam.setup" },
    manual: { type: "text", textKey: "compare.manual.setup" },
  },
  {
    labelKey: "compare.tacticalAnalysis",
    fiq: { type: "text", textKey: "compare.fiq.tactical" },
    gps: { type: "text", textKey: "compare.gps.tactical" },
    cam: { type: "text", textKey: "compare.cam.tactical" },
    manual: { type: "text", textKey: "compare.manual.tactical" },
  },
  {
    labelKey: "compare.aiReports",
    fiq: { type: "text", textKey: "compare.fiq.reports" },
    gps: { type: "text", textKey: "compare.gps.reports" },
    cam: { type: "text", textKey: "compare.cam.reports" },
    manual: { type: "text", textKey: "compare.manual.reports" },
  },
  {
    labelKey: "compare.pressingAnalysis",
    fiq: { type: "check" },
    gps: { type: "x" },
    cam: { type: "limited" },
    manual: { type: "x" },
  },
  {
    labelKey: "compare.opponentScouting",
    fiq: { type: "check" },
    gps: { type: "x" },
    cam: { type: "x" },
    manual: { type: "x" },
  },
  {
    labelKey: "compare.gdprCompliance",
    fiq: { type: "text", textKey: "compare.fiq.gdpr" },
    gps: { type: "text", textKey: "compare.gps.gdpr" },
    cam: { type: "text", textKey: "compare.cam.gdpr" },
    manual: { type: "text", textKey: "compare.manual.gdpr" },
  },
  {
    labelKey: "compare.leagueSuitability",
    fiq: { type: "text", textKey: "compare.fiq.league" },
    gps: { type: "text", textKey: "compare.gps.league" },
    cam: { type: "text", textKey: "compare.cam.league" },
    manual: { type: "text", textKey: "compare.manual.league" },
  },
];

function CellContent({ cell, t }: { cell: { type: CellType; textKey?: string }; t: (k: string) => string }) {
  switch (cell.type) {
    case "check":
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
          <Check className="h-3.5 w-3.5 text-primary" />
        </span>
      );
    case "x":
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10">
          <X className="h-3.5 w-3.5 text-destructive" />
        </span>
      );
    case "limited":
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted">
          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      );
    case "text":
      return <span className="text-sm leading-snug">{t(cell.textKey!)}</span>;
  }
}

export default function ComparePage() {
  const { t } = useTranslation();

  const columns = [
    { key: "fiq", labelKey: "compare.fieldiq", highlight: true },
    { key: "gps", labelKey: "compare.gpsVests", highlight: false },
    { key: "cam", labelKey: "compare.cameraTracking", highlight: false },
    { key: "manual", labelKey: "compare.manualApps", highlight: false },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 py-4">
        <div className="container mx-auto px-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("compare.backToHome")}
            </Link>
          </Button>
          <div className="font-display text-lg font-bold flex items-center gap-1.5">
            <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
            <span>Field</span>
            <span className="gradient-text">IQ</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
              {t("compare.subtitle")}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold font-display mb-4">{t("compare.title")}</h1>
            <p className="text-muted-foreground max-w-lg mx-auto">{t("compare.desc")}</p>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto overflow-x-auto">
            <motion.div
              className="min-w-[700px]"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Column Headers */}
              <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-px mb-1">
                <div /> {/* empty top-left corner */}
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`rounded-t-xl p-4 text-center text-sm font-semibold font-display ${
                      col.highlight
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground"
                    }`}
                  >
                    {col.highlight && <Sparkles className="h-3.5 w-3.5 mx-auto mb-1" />}
                    {t(col.labelKey)}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {rows.map((row, i) => (
                <div
                  key={row.labelKey}
                  className={`grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-px ${
                    i % 2 === 0 ? "bg-card/30" : "bg-card/60"
                  }`}
                >
                  <div className="p-4 flex items-center font-medium text-sm">
                    {t(row.labelKey)}
                  </div>
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className={`p-4 flex items-center justify-center text-center ${
                        col.highlight ? "bg-primary/[0.04]" : ""
                      }`}
                    >
                      <CellContent cell={row[col.key]} t={t} />
                    </div>
                  ))}
                </div>
              ))}

              {/* Bottom row with CTA */}
              <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-px mt-1">
                <div />
                <div className="rounded-b-xl bg-primary/[0.06] p-4 flex justify-center">
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/login">
                      {t("compare.startNow")}
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-b-xl bg-muted/30 p-4" />
                <div className="rounded-b-xl bg-muted/30 p-4" />
                <div className="rounded-b-xl bg-muted/30 p-4" />
              </div>
            </motion.div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center mt-8 max-w-2xl mx-auto">
            {t("compare.disclaimer")}
          </p>
        </div>
      </section>

      {/* Why Different */}
      <section className="py-16 md:py-24 border-t border-border/50">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-4">{t("compare.whyDifferent")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">{t("compare.whyDifferentDesc")}</p>
            <Button variant="hero" size="lg" asChild>
              <Link to="/login">
                {t("compare.startNow")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
