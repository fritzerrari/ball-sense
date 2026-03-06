import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 field-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>

        <div>
          <Link to="/" className="font-display text-2xl font-bold">
            <span className="gradient-text">Field</span>IQ
          </Link>
          <h1 className="text-xl font-semibold font-display mt-4">
            {isLogin ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Melde dich an, um fortzufahren." : "Starte jetzt mit FieldIQ."}
          </p>
        </div>

        <div className="glass-card p-6 space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Vereinsname</label>
              <input type="text" placeholder="FC Musterstadt" className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">E-Mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" placeholder="trainer@verein.de" className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Passwort</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button variant="hero" className="w-full">
            {isLogin ? "Anmelden" : "Konto erstellen"}
          </Button>
        </div>

        <p className="text-sm text-center text-muted-foreground">
          {isLogin ? "Noch kein Konto?" : "Schon ein Konto?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
            {isLogin ? "Jetzt registrieren" : "Anmelden"}
          </button>
        </p>
      </div>
    </div>
  );
}
