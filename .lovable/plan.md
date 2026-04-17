

## Problem
User bekommt "Browser unterstützt nicht" trotz Chrome auf Android. Ursache liegt im `isDisplayCaptureSupported()`-Check in `use-display-capture.ts`.

## Analyse

Der aktuelle Code:
```ts
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);
}
export function isDisplayCaptureSupported(): boolean {
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function" && !isIOS();
}
```

Wahrscheinliche Ursachen:
1. **User testet im Desktop-Browser** (Viewport ist 1567x879 → das ist ein Desktop, kein Phone!) — auf Desktop-Chrome funktioniert getDisplayMedia eigentlich, aber evtl. nicht im Lovable-Preview-Iframe ohne `allow="display-capture"` Permission-Policy.
2. **Iframe-Permission fehlt**: Lovable-Preview läuft in iframe. `getDisplayMedia` benötigt explizit `allow="display-capture"` auf dem iframe — sonst ist `getDisplayMedia` zwar definiert, schlägt aber fehl ODER ist gar nicht verfügbar.
3. **HTTPS-Kontext**: Preview ist HTTPS — sollte OK sein.

Der User sieht den Fehler im Desktop-Preview (1567px), nicht auf seinem Android-Phone. Auf der published URL (`ball-sense.lovable.app` oder `demo6.time2rise.de`) auf Android sollte es prinzipiell laufen.

## Lösung

### 1. `use-display-capture.ts` — Bessere Diagnose
- Differenziertere Fehlermeldungen je nach realer Ursache
- Statt nur `isIOS()` zu blocken: tatsächlich `getDisplayMedia` aufrufen und den echten Browser-Error zeigen
- Erkennen: läuft die App in einem iframe? Falls ja → Hinweis "Öffne FieldIQ direkt unter demo6.time2rise.de, nicht im Editor-Vorschau"
- Desktop-Chrome erlauben (nicht nur Android) — `getDisplayMedia` läuft auch auf Desktop-Chrome/Edge/Firefox

### 2. `ExternalCameraSetup.tsx` — Klarere Hinweise
- Hinweis ergänzen: "Funktioniert nicht im Lovable-Preview-Iframe — bitte Live-URL nutzen"
- Browser-Liste erweitern: Android Chrome, Desktop Chrome/Edge/Firefox

### 3. Iframe-Permission prüfen
- Falls Lovable-Preview kein `allow="display-capture"` setzt, ist das eine Plattform-Limitierung — in dem Fall klare Meldung "Öffne die Live-URL"

## Was unverändert bleibt
- ✅ Capture-Logik selbst
- ✅ Setup-Flow

## Ergebnis
- Im Lovable-Preview-Iframe: klare Meldung "Bitte Live-URL öffnen" statt "Browser nicht unterstützt"
- Auf Live-URL (Desktop oder Android Chrome): funktioniert
- Auf iOS Safari: weiterhin geblockt mit klarer Erklärung

