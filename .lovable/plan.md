

## PWA-Installations-Screen für mobile Geräte

### Konzept

Wenn ein mobiles Geraet die Seite im Browser oeffnet (nicht als PWA), wird **vor** dem Login-Screen ein fullscreen Installations-Screen angezeigt. Dieser erklaert in 2-3 einfachen Schritten die Installation und bietet einen grossen Install-Button. Der User kann ihn ueberspringen ("Erstmal weiter ohne App"), um zum Login/Register/Kamera-Screen zu gelangen.

Wenn die PWA bereits installiert ist (`display-mode: standalone`), wird der Screen komplett uebersprungen.

### Aenderungen

**1. Neuer Fullscreen-Install-Screen in `Login.tsx`**

- Vor den Login-Tabs wird geprueft: `isMobile && !isStandalone && !installSkipped`
- Wenn ja → Fullscreen-Overlay mit:
  - FieldIQ Logo + "App installieren fuer das beste Erlebnis"
  - **Android**: Grosser "App installieren" Button (nutzt `deferredPrompt.prompt()`)
  - **iOS**: 3-Schritt Safari-Anleitung mit Icons (Teilen → Zum Home-Bildschirm → Hinzufuegen)
  - "Ohne App weiter" Link unten (setzt `installSkipped = true` in State + sessionStorage)
- Design: Fullscreen, zentriert, glassmorphism-Karte, grosse Touch-Targets

**2. State-Management**

- Neuer State `installSkipped` in Login.tsx
- `sessionStorage` Key `pwa-install-skipped` damit der Screen pro Browser-Session nur 1x erscheint
- `usePwaInstall` Hook wird wiederverwendet fuer `isStandalone`, `isIos`, `install()`

**3. Kein separater Route/Page noetig**

Der Install-Screen ist ein bedingtes Overlay innerhalb von `Login.tsx` — kein neuer Route, kein neues File. Einfach und wartbar.

### Dateien

- `src/pages/Login.tsx` — Install-Overlay vor Login-Tabs hinzufuegen

