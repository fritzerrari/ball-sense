import { useEffect, useState } from "react";

/**
 * Read battery status via the (non-standard) Battery Status API.
 * Returns null on unsupported browsers (Safari/iOS — most likely platform for helpers).
 *
 * On unsupported browsers, the UI should fall back to a manual reminder instead
 * of treating "no battery info" as "battery full".
 */
interface BatteryManager extends EventTarget {
  level: number;          // 0..1
  charging: boolean;
  chargingTime: number;   // seconds, Infinity if not charging
  dischargingTime: number;// seconds, Infinity if charging
}

export interface BatteryStatus {
  /** 0..100, integer */
  level: number;
  charging: boolean;
  /** True when API is supported and reading was successful */
  supported: boolean;
}

export function useBatteryStatus(): BatteryStatus | null {
  const [status, setStatus] = useState<BatteryStatus | null>(null);

  useEffect(() => {
    let battery: BatteryManager | null = null;
    let cancelled = false;

    const update = () => {
      if (!battery || cancelled) return;
      setStatus({
        level: Math.round(battery.level * 100),
        charging: battery.charging,
        supported: true,
      });
    };

    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (typeof nav.getBattery !== "function") {
      // Unsupported (iOS Safari) — return null so UI can show "Akku-Status nicht verfügbar".
      setStatus(null);
      return;
    }

    nav.getBattery().then((b) => {
      if (cancelled) return;
      battery = b;
      update();
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
    }).catch(() => {
      setStatus(null);
    });

    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener("levelchange", update);
        battery.removeEventListener("chargingchange", update);
      }
    };
  }, []);

  return status;
}

export function batterySeverity(status: BatteryStatus | null): "ok" | "low" | "critical" | "unknown" {
  if (!status) return "unknown";
  if (status.charging) return "ok";
  if (status.level <= 10) return "critical";
  if (status.level <= 20) return "low";
  return "ok";
}
