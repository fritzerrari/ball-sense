import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Map, Swords, Settings, LogOut, ChevronLeft, Menu, BrainCircuit,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Spiele", icon: Swords, href: "/matches" },
  { label: "Kader", icon: Users, href: "/players" },
  { label: "Plätze", icon: Map, href: "/fields" },
  { label: "KI Assistent", icon: BrainCircuit, href: "/assistant" },
  { label: "Einstellungen", icon: Settings, href: "/settings" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clubName, clubPlan, clubLogoUrl, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const planLabel = clubPlan === "starter" ? "Starter" : clubPlan === "club" ? "Club" : clubPlan === "pro" ? "Pro" : "Trial";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200
          ${collapsed ? "w-16" : "w-56"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link to="/dashboard" className="font-display text-lg font-bold flex items-center gap-1">
              <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">F</span>
              <span className="text-foreground">Field</span>
              <span className="gradient-text">IQ</span>
            </Link>
          )}
          {collapsed && (
            <Link to="/dashboard" className="mx-auto">
              <span className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-black">F</span>
            </Link>
          )}
          {!collapsed && (
            <button
              onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
            >
              <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                  ${collapsed ? "justify-center" : ""}
                `}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-4 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Abmelden</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-h-screen">
        <header className="h-16 border-b border-border flex items-center px-4 md:px-6 gap-4 bg-card/50">
          <button className="md:hidden p-2 hover:bg-muted rounded-lg" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="hidden md:block p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          )}
          {clubName && (
            <div className="flex items-center gap-2 hidden sm:flex">
              {clubLogoUrl && (
                <img src={clubLogoUrl} alt={clubName} className="w-7 h-7 rounded-md object-cover border border-border" />
              )}
              <span className="text-sm font-medium font-display">{clubName}</span>
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">{planLabel}</span>
          </div>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
