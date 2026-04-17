
## Diagnose

Die frühere Gesture-/iframe-Analyse war nur ein Teil des Problems. Nach Code- und API-Abgleich ist der eigentliche Hauptpunkt:

- `getDisplayMedia()` ist in `use-display-capture.ts` die technische Basis der ganzen „Externe Kamera“-Idee.
- Diese Basis ist auf **Chrome/Edge Android im mobilen Browser nicht verlässlich bzw. laut aktueller Kompatibilität nicht unterstützt**.
- Deshalb ist die Meldung „Browser unterstützt Capture nicht“ auf Android am Ende **inhaltlich korrekt** – auch wenn Chrome selbst genutzt wird.
- Der aktuelle Workflow ist also nicht nur UX-seitig, sondern **plattformseitig falsch zugeschnitten**.

Kurz: Die Web-App kann die Android-Kamera-App per Bildschirmfreigabe nicht robust als Quelle verwenden. Das ist kein kleiner Bug mehr, sondern ein **falscher technischer Ansatz für Mobile Web**.

## Lösung

### 1. Feature neu zuschneiden: kein Android-Browser-Screen-Capture mehr
Ich würde die „Externe Kamera“-Funktion im Web **nicht mehr als Android-Lösung** anbieten.

Stattdessen:
- Android mobile browser: **klar als nicht unterstützt blocken**
- Desktop browser: optional weiter erlauben als Beta
- iOS: weiter blocken

Damit verschwindet die falsche Erwartung „Chrome auf Android müsste doch gehen“.

### 2. Capability Detection korrekt machen
`src/hooks/use-display-capture.ts`
- Neue Erkennung für:
  - `android_mobile_unsupported`
  - `iframe_blocked`
  - `ios_unsupported`
  - `api_missing`
  - `permission_denied`
  - `selection_cancelled`
  - `no_source`
- `supported` darf nicht mehr nur `getDisplayMedia` + `!isIOS` sein.
- Android-Mobile-Browser müssen explizit als **nicht unterstützt** behandelt werden.

### 3. UX im Auswahl-Screen korrigieren
`src/components/MatchRecordingChoice.tsx`
- „Externe Kamera“ nicht mehr mit „Nur Android“ bewerben.
- Stattdessen z. B.:
  - „Desktop Beta“
  - auf Android: Badge „Im mobilen Browser nicht möglich“
- Optional disabled state auf Android statt normal auswählbar.

### 4. Setup-Dialog in echte Richtungen aufteilen
`src/components/ExternalCameraSetup.tsx`
- Android:
  - deutliche Blocker-Meldung
  - Erklärung: mobile Browser können das Kamera-App-Bild nicht per Screen Capture übernehmen
  - direkte Alternativen anzeigen:
    - „Ich filme selbst“
    - „Helfer filmt“
    - „Video hochladen“
- Preview-iframe:
  - separater Hinweis „nur Live-URL“
- Desktop:
  - Beta-Hinweis + normaler Start-CTA

### 5. Route-Level Guard einbauen
`src/pages/CameraTrackingPage.tsx`
- Wenn `?mode=external` auf Android mobile geöffnet wird:
  - gar nicht erst in den bisherigen External-Capture-Flow gehen
  - stattdessen sofort erklärende Meldung + Rückweg/Fallback anbieten
- So landet niemand mehr in einem technisch unmöglichen Flow.

### 6. Copy und Erwartungsmanagement bereinigen
Auch die Memory/Copy ist aktuell widersprüchlich („Android-only“ vs. „Desktop auch“).
Ich würde alle Texte angleichen auf:
- **Desktop-Browser: Beta**
- **Android/iPhone mobile browser: nicht unterstützt**
- Für Android als Alternative: normales Filmen, Helfer-Flow oder Upload-Flow

## Was bewusst nicht gebaut wird

Ich würde **keinen weiteren Workaround auf Android-Web** versuchen, weil:
- Browser-Screen-Capture dort die falsche Grundlage ist
- PWA das Problem nicht zuverlässig löst
- dafür realistisch eine **native Android-App / Companion-App** oder eine **kamera-spezifische Direktintegration** nötig wäre

Beides ist eine eigene Produktentscheidung, nicht ein kleiner Frontend-Fix.

## Ergebnis

Nach Umsetzung:
- keine falsche Android-Erwartung mehr
- keine irreführende „Chrome müsste gehen“-Situation mehr
- sauberer, ehrlicher Workflow mit klaren Alternativen
- Desktop-Beta bleibt möglich, mobiler Browser wird korrekt abgefangen

## Betroffene Dateien

- `src/hooks/use-display-capture.ts`
- `src/components/MatchRecordingChoice.tsx`
- `src/components/ExternalCameraSetup.tsx`
- `src/pages/CameraTrackingPage.tsx`

## Technische Details

```text
Neuer Entscheidungsbaum

external mode gewählt
→ iOS? blocken
→ Android mobile browser? blocken + Alternativen
→ iframe? Live-URL-Hinweis
→ Desktop + getDisplayMedia vorhanden?
   → Beta-Flow erlauben
   → sonst API-Meldung
```

Wenn du das freigibst, setze ich den Flow auf eine ehrliche, funktionierende Variante um statt weiter Android-Chrome-Workarounds hinterherzulaufen.
