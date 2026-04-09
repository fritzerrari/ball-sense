import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Brain,
  BookOpen,
  BrainCircuit,
  Download,
  Home,
  LogOut,
  Map,
  MoreHorizontal,
  Settings,
  Shield,
  Users,
  Swords,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { MobileInstallFab } from "./MobileInstallFab";
import { NotificationBell } from "./NotificationBell";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "@/lib/i18n";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clubName, clubPlan, clubLogoUrl, signOut } = useAuth();
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: isAdmin } = useQuery({
    queryKey: ["user_role_sidebar", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const mainItems = [
    { label: t("nav.dashboard"), icon: Home, href: "/dashboard" },
    { label: t("nav.matches"), icon: Swords, href: "/matches" },
    { label: t("nav.squad"), icon: Users, href: "/players" },
    { label: t("nav.trends"), icon: TrendingUp, href: "/trends" },
    { label: t("nav.matchPrep") ?? "Spielvorbereitung", icon: Brain, href: "/match-prep" },
    { label: t("nav.assistant"), icon: BrainCircuit, href: "/assistant" },
  ];

  const manageItems = [
    { label: t("nav.fields"), icon: Map, href: "/fields" },
    { label: t("nav.settings"), icon: Settings, href: "/settings" },
    { label: t("nav.install"), icon: Download, href: "/install" },
    { label: "Tutorial", icon: BookOpen, href: "/tutorial" },
  ];

  const adminItems = isAdmin ? [{ label: t("nav.admin"), icon: Shield, href: "/admin" }] : [];

  const isActive = (href: string) => {
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const planLabel = clubPlan === "starter" ? "Starter" : clubPlan === "club" ? "Club" : clubPlan === "pro" ? "Pro" : "Trial";

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar md:flex md:min-h-screen md:flex-col">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold">
            {clubLogoUrl ? (
              <img src={clubLogoUrl} alt={clubName ?? "FieldIQ"} className="h-9 w-9 rounded-lg border border-border object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">F</span>
            )}
            <span>Field<span className="gradient-text">IQ</span></span>
          </Link>
          {clubName && <p className="mt-2 text-sm text-muted-foreground">{clubName}</p>}
        </div>

        <div className="flex-1 space-y-6 px-3 py-5">
          <nav className="space-y-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("nav.core")}</p>
            {mainItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? "border border-primary/20 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <nav className="space-y-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("nav.manage")}</p>
            {manageItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? "border border-primary/20 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {adminItems.length > 0 && (
            <nav className="space-y-1">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Admin</p>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? "border border-primary/20 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>{t("nav.signout")}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-[100dvh] pb-20 md:pb-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4 md:px-6">
            <div className="min-w-0 md:hidden">
              <Link to="/dashboard" className="font-display text-lg font-bold">Field<span className="gradient-text">IQ</span></Link>
            </div>
            <div className="hidden min-w-0 md:block">
              {clubName && <p className="truncate text-sm font-medium font-display">{clubName}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <LanguageToggle />
              <ThemeToggle />
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{planLabel}</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8">{children}</div>
        <MobileInstallFab />
      </main>

      {/* Mobile bottom navigation — clean 4-tab + more */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5 px-1">
          {[
            { label: t("nav.dashboard"), icon: Home, href: "/dashboard" },
            { label: t("nav.matches"), icon: Swords, href: "/matches" },
            { label: t("nav.squad"), icon: Users, href: "/players" },
            { label: t("nav.trends"), icon: TrendingUp, href: "/trends" },
          ].map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                isActive(item.href) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.href) ? "" : "opacity-70"}`} />
              <span>{item.label}</span>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5 opacity-70" />
            <span>{t("nav.more")}</span>
          </button>
        </div>
      </div>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background">
          <SheetHeader>
            <SheetTitle className="font-display">{t("nav.more")}</SheetTitle>
            <SheetDescription>{t("nav.manage")}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {[
              { label: t("nav.assistant"), icon: BrainCircuit, href: "/assistant" },
              ...manageItems,
              ...adminItems,
            ].map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium text-foreground"
              >
                <item.icon className="h-5 w-5 text-primary" />
                <span>{item.label}</span>
              </Link>
            ))}

            <button
              type="button"
              onClick={async () => {
                setMoreOpen(false);
                await handleSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium text-foreground"
            >
              <LogOut className="h-5 w-5 text-primary" />
              <span>{t("nav.signout")}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
