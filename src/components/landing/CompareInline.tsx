import { motion } from "framer-motion";
import { Check, X, Minus, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type CellValue = true | false | string;

interface Row {
  label: string;
  fieldiq: CellValue;
  gps: CellValue;
  camera: CellValue;
  manual: CellValue;
}

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs text-muted-foreground text-center block">{value}</span>;
}

export function CompareInline() {
  const { language } = useTranslation();
  const de = language === "de";

  const rows: Row[] = [
    {
      label: de ? "Hardware-Kosten" : "Hardware cost",
      fieldiq: de ? "0 €" : "€0",
      gps: de ? "2.000–15.000 €" : "€2k–15k",
      camera: de ? "5.000–50.000 €" : "€5k–50k",
      manual: de ? "0 €" : "€0",
    },
    {
      label: de ? "Setup-Zeit" : "Setup time",
      fieldiq: de ? "2 Min" : "2 min",
      gps: de ? "15–20 Min" : "15–20 min",
      camera: de ? "30–60 Min" : "30–60 min",
      manual: de ? "0 Min" : "0 min",
    },
    {
      label: de ? "Taktik-Analyse" : "Tactical analysis",
      fieldiq: true,
      gps: false,
      camera: true,
      manual: false,
    },
    {
      label: de ? "Formationen & Pressing" : "Formations & pressing",
      fieldiq: true,
      gps: false,
      camera: de ? "Teilweise" : "Partial",
      manual: false,
    },
    {
      label: de ? "KI-Coaching-Report" : "AI coaching report",
      fieldiq: true,
      gps: false,
      camera: false,
      manual: false,
    },
    {
      label: de ? "DSGVO-konform" : "GDPR compliant",
      fieldiq: true,
      gps: true,
      camera: de ? "Teilweise" : "Partial",
      manual: true,
    },
  ];

  const headers = [
    { label: "FieldIQ", highlight: true },
    { label: de ? "GPS-Westen" : "GPS vests", highlight: false },
    { label: de ? "Kamerasysteme" : "Camera systems", highlight: false },
    { label: de ? "Manuelle Apps" : "Manual apps", highlight: false },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">
            {de ? "Vergleich" : "Comparison"}
          </span>
          <h2 className="text-2xl md:text-4xl font-bold font-display mb-3">
            {de ? (
              <>Warum FieldIQ <span className="gradient-text">die smarte Wahl</span> ist</>
            ) : (
              <>Why FieldIQ is <span className="gradient-text">the smart choice</span></>
            )}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {de
              ? "Kein teures Equipment, kein kompliziertes Setup — volle taktische Tiefe."
              : "No expensive equipment, no complex setup — full tactical depth."}
          </p>
        </motion.div>

        {/* Desktop table */}
        <motion.div
          className="hidden md:block max-w-4xl mx-auto rounded-2xl border border-border overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium w-[28%]" />
                {headers.map((h) => (
                  <th
                    key={h.label}
                    className={`py-3 px-3 text-xs font-semibold font-display text-center w-[18%] ${
                      h.highlight ? "text-primary bg-primary/5" : "text-muted-foreground"
                    }`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-3 px-4 text-xs font-medium text-foreground">{row.label}</td>
                  <td className="py-3 px-3 bg-primary/[0.03]"><Cell value={row.fieldiq} /></td>
                  <td className="py-3 px-3"><Cell value={row.gps} /></td>
                  <td className="py-3 px-3"><Cell value={row.camera} /></td>
                  <td className="py-3 px-3"><Cell value={row.manual} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3 max-w-sm mx-auto">
          {rows.map((row, i) => (
            <motion.div
              key={i}
              className="rounded-xl border border-border/50 bg-card/50 p-4"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <p className="text-xs font-semibold mb-2">{row.label}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {[
                  { label: "FieldIQ", val: row.fieldiq, highlight: true },
                  { label: de ? "GPS-Westen" : "GPS vests", val: row.gps, highlight: false },
                  { label: de ? "Kamera" : "Camera", val: row.camera, highlight: false },
                  { label: de ? "Manuell" : "Manual", val: row.manual, highlight: false },
                ].map((col) => (
                  <div
                    key={col.label}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${
                      col.highlight ? "bg-primary/10 text-primary font-semibold" : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {col.val === true ? <Check className="h-3 w-3 shrink-0" /> :
                     col.val === false ? <X className="h-3 w-3 shrink-0 opacity-40" /> :
                     null}
                    <span className="truncate">{col.val === true ? col.label : col.val === false ? col.label : `${col.label}: ${col.val}`}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" size="sm" asChild>
            <Link to="/compare">
              {de ? "Vollständigen Vergleich ansehen" : "View full comparison"}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
