import { motion } from "framer-motion";
import {
  Smartphone,
  Brain,
  BarChart3,
  Shield,
  Users,
  Zap,
  FileText,
  Dumbbell,
  Share2,
  Clipboard,
  Siren,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function FeatureCards() {
  const { t, language } = useTranslation();

  const features = [
    {
      icon: Smartphone,
      title: t("landing.feat1Title"),
      desc: t("landing.feat1Desc"),
      span: "sm:col-span-2",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: Clipboard,
      title: language === "de" ? "Coach Summary zum Einstieg" : "Coach Summary at a glance",
      desc:
        language === "de"
          ? "Startet jeden Report mit Spielkontrolle, Fokusspieler, Datenwarnung und nächster Coaching-Aktion."
          : "Open every report with match control, focus player, data warning and the next coaching action.",
      span: "",
      accent: "from-accent/20 to-accent/5",
    },
    {
      icon: BarChart3,
      title: language === "de" ? "Interaktive Leaderboards" : "Interactive leaderboards",
      desc:
        language === "de"
          ? "Top-Speed, Passquote, Sprints und Zweikämpfe als moderne Rankings mit klarer visueller Einordnung."
          : "Top speed, passing, sprints and duels in modern ranking cards with clear visual context.",
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: Siren,
      title: language === "de" ? "Datenqualität im Blick" : "Built-in data quality alerts",
      desc:
        language === "de"
          ? "Auffällige Werte wie unrealistische Topspeeds werden direkt im Cockpit markiert statt erst im Nachhinein entdeckt."
          : "Suspicious values like unrealistic top speeds are flagged directly in the cockpit instead of later.",
      span: "",
      accent: "from-accent/15 to-transparent",
    },
    {
      icon: Brain,
      title: t("landing.feat2Title"),
      desc: t("landing.feat2Desc"),
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: Sparkles,
      title: language === "de" ? "Was-wäre-wenn-Analyse" : "What-if tactical board",
      desc:
        language === "de"
          ? "Teste Formationen, Rollen und Positionswechsel direkt aus dem Match-Report heraus."
          : "Test formations, roles and position switches directly from the match report.",
      span: "sm:col-span-2",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: FileText,
      title: t("landing.feat7Title"),
      desc: t("landing.feat7Desc"),
      span: "sm:col-span-2",
      accent: "from-accent/15 to-transparent",
    },
    {
      icon: Dumbbell,
      title: t("landing.feat8Title"),
      desc: t("landing.feat8Desc"),
      span: "",
      accent: "from-primary/20 to-primary/5",
    },
    {
      icon: Share2,
      title: t("landing.feat9Title"),
      desc: t("landing.feat9Desc"),
      span: "",
      accent: "from-accent/20 to-accent/5",
    },
    {
      icon: Shield,
      title: t("landing.feat4Title"),
      desc: t("landing.feat4Desc"),
      span: "",
      accent: "from-primary/15 to-transparent",
    },
    {
      icon: Users,
      title: t("landing.feat5Title"),
      desc: t("landing.feat5Desc"),
      span: "",
      accent: "from-accent/15 to-transparent",
    },
    {
      icon: Zap,
      title: t("landing.feat6Title"),
      desc: t("landing.feat6Desc"),
      span: "sm:col-span-2 lg:col-span-1",
      accent: "from-primary/20 to-primary/5",
    },
  ];

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container mx-auto px-4">
        <motion.div
          className="max-w-5xl mx-auto mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <span className="text-xs font-semibold text-primary font-display tracking-wider uppercase mb-3 block">{t("landing.features")}</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              {t("landing.featuresTitle")}
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed md:text-right">
            {language === "de"
              ? "Vom schnellen Trainer-Überblick bis zur Datenwarnung: das neue Coaching-Cockpit bringt Analyse, Priorisierung und Taktik in einen klaren Flow."
              : "From instant coach summaries to data warnings: the new coaching cockpit brings analysis, prioritization and tactics into one clear flow."}
          </p>
        </motion.div>

        <motion.div
          className="max-w-5xl mx-auto mb-10 h-px overflow-hidden"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            initial={{ x: "-100%" }}
            whileInView={{ x: "0%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className={`group relative rounded-2xl border border-border/50 bg-card/50 p-7 transition-all duration-500 overflow-hidden ${feature.span}`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, borderColor: "hsl(var(--primary) / 0.3)" }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />

              <motion.div
                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: "var(--shadow-glow)" }}
              />

              <div className="relative">
                <motion.div
                  className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-all duration-300"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <feature.icon className="h-5 w-5 text-primary" />
                </motion.div>
                <h3 className="text-base font-semibold font-display mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
