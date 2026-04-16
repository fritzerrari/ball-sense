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

if (isPreviewHost || isEmbeddedPreview) {
  void cleanupPreviewRuntimeArtifacts();
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
