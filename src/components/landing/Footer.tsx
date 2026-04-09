import { Link } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border/50 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          <div>
            <div className="font-display text-lg font-bold flex items-center gap-1.5 mb-4">
              <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
              <span>Field</span>
              <span className="gradient-text">IQ</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("landing.footerDesc")}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">{t("landing.product")}</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{t("landing.features")}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{t("landing.pricing")}</a></li>
              <li><Link to="/compare" className="hover:text-foreground transition-colors">{t("compare.title")}</Link></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">{t("landing.faq")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">{t("landing.help")}</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li><Link to="/tutorial" className="hover:text-foreground transition-colors">Tutorial</Link></li>
              <li><Link to="/install" className="hover:text-foreground transition-colors">{t("landing.installation")}</Link></li>
              <li><Link to="/login" className="hover:text-foreground transition-colors">{t("landing.signIn")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">{t("landing.legal")}</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li><Link to="/legal/impressum" className="hover:text-foreground transition-colors">{t("landing.imprint")}</Link></li>
              <li><Link to="/legal/datenschutz" className="hover:text-foreground transition-colors">{t("landing.privacyPolicy")}</Link></li>
              <li><Link to="/legal/agb" className="hover:text-foreground transition-colors">{t("landing.termsOfService")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{t("landing.copyright")}</p>
          <p className="text-xs text-muted-foreground">{t("landing.madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}
