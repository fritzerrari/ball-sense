import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { I18nProvider } from "@/lib/i18n";
import App from "./App";
import "./index.css";

const hostname = window.location.hostname;
const isPreviewHost =
  import.meta.env.DEV ||
  hostname.includes("lovableproject.com") ||
  hostname.includes("id-preview--");

async function cleanupPreviewRuntimeArtifacts() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
  }
}

// Never register PWA in preview/dev environments to prevent stale caches and blank-screen loops.
if (!isPreviewHost) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.log("FieldIQ ist offline bereit");
    },
    onNeedRefresh() {
      console.log("Neue App-Version verfügbar");
    },
  });
} else {
  void cleanupPreviewRuntimeArtifacts();
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
