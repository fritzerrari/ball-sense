// Web-Push Helpers für die Eltern-Self-Service-Seite.
// Registriert einen separaten Service Worker (/push-sw.js) und subscribed via VAPID.
import { supabase } from "@/integrations/supabase/client";

let cachedVapidKey: string | null = null;
async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;
  const { data, error } = await supabase.functions.invoke("vapid-public-key");
  if (error || !data?.publicKey) {
    throw new Error("VAPID-Schlüssel konnte nicht geladen werden");
  }
  cachedVapidKey = data.publicKey;
  return cachedVapidKey!;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function subscribeForPush(): Promise<PushKeys> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push wird in diesem Browser nicht unterstützt");
  }
  const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/push/" }).catch(async () => {
    return navigator.serviceWorker.register("/push-sw.js");
  });
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Benachrichtigungen wurden abgelehnt");

  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const vapidKey = await getVapidPublicKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
  });

  return {
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64Url(sub.getKey("p256dh")),
    auth: arrayBufferToBase64Url(sub.getKey("auth")),
  };
}

export async function unsubscribePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
