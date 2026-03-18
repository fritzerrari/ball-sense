import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { I18nProvider } from "@/lib/i18n";
import App from "./App";
import "./index.css";

registerSW({
  immediate: true,
  onOfflineReady() {
    console.log("FieldIQ ist offline bereit");
  },
  onNeedRefresh() {
    console.log("Neue App-Version verfügbar");
  },
});

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
