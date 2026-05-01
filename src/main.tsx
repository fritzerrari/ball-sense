import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/lib/i18n";
import App from "./App";
import "./index.css";

const hostname = window.location.hostname;
const isPreviewHost =
  import.meta.env.DEV ||
  hostname.includes("lovableproject.com") ||
  hostname.includes("id-preview--");

const isEmbeddedPreview = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

/**
 * Bumping this string forces a one-time SW + cache wipe in every browser
 * the next time it loads the app. Increment whenever a stale-cache hang
 * is suspected after a deploy.
 */
const RUNTIME_CLEANUP_VERSION = "2026-05-01-cache-bust-2";
const CLEANUP_KEY = "fieldiq_runtime_cleanup_version";

async function cleanupRuntimeArtifacts() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch {
    // best-effort
  }
}

async function bootstrap() {
  // Always wipe in preview/embedded contexts (legacy behavior).
  if (isPreviewHost || isEmbeddedPreview) {
    await cleanupRuntimeArtifacts();
  } else {
    // On production domains, wipe exactly once per RUNTIME_CLEANUP_VERSION,
    // then hard-reload so the user gets a fresh bundle without stale SW.
    try {
      const stored = localStorage.getItem(CLEANUP_KEY);
      if (stored !== RUNTIME_CLEANUP_VERSION) {
        await cleanupRuntimeArtifacts();
        localStorage.setItem(CLEANUP_KEY, RUNTIME_CLEANUP_VERSION);
        // Reload once so the freshly fetched bundle takes over.
        window.location.reload();
        return;
      }
    } catch {
      // localStorage unavailable — skip versioned cleanup, render normally.
    }
  }

  createRoot(document.getElementById("root")!).render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}

void bootstrap();
