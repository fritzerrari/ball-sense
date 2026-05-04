// Minimal Web Push (VAPID + aes128gcm) for Deno Edge.
// Spec: RFC 8030 + RFC 8291 + RFC 8292.
// No external deps.

function b64urlEncode(bytes: Uint8Array): string {
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

async function importVapidPrivKey(privB64: string, pubB64: string): Promise<CryptoKey> {
  const d = b64urlDecode(privB64);
  const pub = b64urlDecode(pubB64); // 65 bytes uncompressed
  const x = pub.slice(1, 33), y = pub.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    d: b64urlEncode(d),
    x: b64urlEncode(x),
    y: b64urlEncode(y),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signVapidJwt(audience: string, subject: string, pubKey: string, privKey: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject };
  const enc = new TextEncoder();
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = enc.encode(`${h}.${p}`);
  const key = await importVapidPrivKey(privKey, pubKey);
  const sigDer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${h}.${p}.${b64urlEncode(new Uint8Array(sigDer))}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, concat(info, new Uint8Array([0x01]))));
  return t.slice(0, length);
}

async function encryptPayload(payload: Uint8Array, p256dhB64: string, authB64: string): Promise<{ body: Uint8Array; localPub: Uint8Array }> {
  const recipientPub = b64urlDecode(p256dhB64);
  const auth = b64urlDecode(authB64);

  // Generate ephemeral local ECDH keypair
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubJwk = await crypto.subtle.exportKey("jwk", local.publicKey);
  const lx = b64urlDecode(localPubJwk.x!); const ly = b64urlDecode(localPubJwk.y!);
  const localPubRaw = concat(new Uint8Array([0x04]), lx, ly);

  // Import recipient pub key
  const rx = recipientPub.slice(1, 33), ry = recipientPub.slice(33, 65);
  const recipientKey = await crypto.subtle.importKey("jwk",
    { kty: "EC", crv: "P-256", x: b64urlEncode(rx), y: b64urlEncode(ry), ext: true },
    { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedRaw = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: recipientKey }, local.privateKey, 256));

  // PRK_key = HKDF(auth, sharedRaw, "WebPush: info\0" || ua_pub || as_pub, 32)
  const enc = new TextEncoder();
  const keyInfo = concat(enc.encode("WebPush: info\0"), recipientPub, localPubRaw);
  const ikm = await hkdf(auth, sharedRaw, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, concat(enc.encode("Content-Encoding: aes128gcm\0")), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode("Content-Encoding: nonce\0")), 12);

  // Pad: payload || 0x02 (last record marker)
  const padded = concat(payload, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  // Header: salt(16) || rs(4) || idlen(1) || keyid(localPubRaw,65)
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw);
  return { body: concat(header, ciphertext), localPub: localPubRaw };
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult { ok: boolean; status: number; expired: boolean; error?: string; }

export async function sendWebPush(sub: PushSubscription, payload: object): Promise<PushResult> {
  const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUB = Deno.env.get("VAPID_SUBJECT") || "mailto:info@time2rise.de";
  if (!VAPID_PUB || !VAPID_PRIV) return { ok: false, status: 0, expired: false, error: "vapid_not_configured" };

  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(audience, VAPID_SUB, VAPID_PUB, VAPID_PRIV);

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const { body } = await encryptPayload(payloadBytes, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUB}`,
    },
    body,
  });
  const expired = res.status === 404 || res.status === 410;
  let err: string | undefined;
  if (!res.ok) { try { err = await res.text(); } catch (_) { err = String(res.status); } }
  return { ok: res.ok, status: res.status, expired, error: err };
}
