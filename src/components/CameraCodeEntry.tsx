import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CAMERA_ACCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-access`;

interface CameraCodeEntryProps {
  onSuccess: (data: { matchId: string; cameraIndex: number; sessionToken: string }) => void;
}

export default function CameraCodeEntry({ onSuccess }: CameraCodeEntryProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSubmittedRef = useRef(false);

  // Auto-fill from URL parameter ?code=XXXXXX
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code")?.replace(/\D/g, "").slice(0, 6);
    if (urlCode && urlCode.length === 6) {
      autoSubmittedRef.current = true;
      setDigits(urlCode.split(""));
      setTimeout(() => submitCode(urlCode), 200);
      return;
    }
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  const submitCode = useCallback(async (code: string) => {
    setSubmitting(true);
    setError("");
    if (navigator.vibrate) navigator.vibrate(30);

    try {
      const resp = await fetch(CAMERA_ACCESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", code }),
      });
      const data = await resp.json().catch(() => ({ error: "Verbindung fehlgeschlagen" }));
      if (!resp.ok) throw new Error(data.error || "Code ungültig");

      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      toast.success("Kamera verbunden!");
      onSuccess({
        matchId: data.matchId,
        cameraIndex: data.cameraIndex,
        sessionToken: data.sessionToken,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Code ungültig";
      setError(msg);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } finally {
      setSubmitting(false);
    }
  }, [onSuccess]);

  const handleChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    
    setDigits(prev => {
      const next = [...prev];
      next[index] = digit;
      
      // Auto-advance to next input
      if (digit && index < 5) {
        setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
      }
      
      // Auto-submit when all 6 digits are entered
      if (digit && index === 5) {
        const code = next.join("");
        if (code.length === 6) {
          setTimeout(() => submitCode(code), 50);
        }
      }
      
      return next;
    });
    
    if (digit && navigator.vibrate) navigator.vibrate(15);
    setError("");
  }, [submitCode]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigits(prev => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split("");
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      setTimeout(() => submitCode(pasted), 50);
    }
  }, [submitCode]);

  const code = digits.join("");
  const isFull = code.length === 6;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 safe-area-pad">
      {/* Background effects */}
      <div className="absolute inset-0 field-grid opacity-10" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px]" />

      <div className="w-full max-w-sm relative z-10 space-y-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black font-display shadow-lg">
            F
          </div>
          <div className="font-display text-2xl font-bold flex items-center gap-1.5">
            <span className="text-foreground">Field</span>
            <span className="gradient-text">IQ</span>
          </div>
        </div>

        {/* Camera icon + title */}
        <div className="space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Camera className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-display">Kamera-Code eingeben</h1>
          <p className="text-sm text-muted-foreground">
            Gib den 6-stelligen Code ein, den du vom Trainer erhalten hast.
          </p>
        </div>

        {/* OTP-style digit inputs */}
        <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={submitting}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error ? "border-destructive bg-destructive/5" : digit ? "border-primary/40 bg-primary/5" : "border-border bg-muted"}
                text-foreground`}
              aria-label={`Ziffer ${i + 1}`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {submitting && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Code wird überprüft…</span>
          </div>
        )}

        {/* Manual submit button (fallback) */}
        {isFull && !submitting && (
          <Button
            onClick={() => submitCode(code)}
            size="lg"
            className="w-full h-14 text-base gap-2"
          >
            <Camera className="h-5 w-5" />
            Kamera starten
          </Button>
        )}

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          Kein Code? Frag deinen Trainer — er kann den Code in der App generieren.
        </p>
      </div>
    </div>
  );
}
