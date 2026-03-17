

## Plan: Geführter Wizard + Prozess-Fixes + Mobile/PWA Download

### Analyse der gefundenen Probleme

1. **Onboarding-Wizard (Onboarding.tsx)**: `useState` wird als Side-Effect-Hook missbraucht (Zeile 63-70 für `beforeinstallprompt`, Zeile 23-28 in FieldCalibration). Muss `useEffect` sein.
2. **Substitution-Logik (TrackingPage.tsx)**: Wechsel werden nur als Toast angezeigt, aber nicht in `match_lineups` persistiert (`subbed_in_min`, `subbed_out_min`).
3. **NewMatch Step 3 Validierung**: `canProceed()` prüft auf 11 Gastspieler, aber das Ausfüllen ist optional (Freundschaftsspiel ohne Gast-Kader).
4. **Kein geführter "Wizard" für den Gesamtprozess**: Neue User wissen nicht, welchen Schritt sie als Nächstes tun müssen. Der SetupChecklist zeigt nur Spieler+Feld, nicht den Match-Workflow.
5. **PWA Download-Button fehlt in der mobilen Navigation**: Kein sichtbarer "Installieren"-CTA außerhalb des Dashboard-Prompts.
6. **FieldCalibration nicht responsive**: Punkte-Klick funktioniert, aber es fehlen Hinweistexte für mobile User und Touch-Feedback.

### Was gebaut wird

**1. Guided Match-Wizard (erweiterte SetupChecklist → MatchWizardBanner)**
- Neues Component `MatchFlowGuide.tsx`: Kontextsensitiver Banner auf dem Dashboard und der Match-Detailseite
- Zeigt den aktuellen Schritt im Gesamtprozess: Kader → Feld → Feld kalibrieren → Spiel anlegen → Tracking starten → Report ansehen
- Jeder Schritt mit Icon, Titel, Status (erledigt/offen/aktiv) und direktem Link zur Aktion
- Prüft automatisch: Spieler vorhanden? Feld vorhanden? Feld kalibriert? Spiel erstellt? Tracking-Upload vorhanden?

**2. Bug-Fixes im Tracking-Prozess**
- **Substitution persistieren**: `handleSub` in TrackingPage aktualisiert `match_lineups` via Supabase (`subbed_in_min`/`subbed_out_min`)
- **useState → useEffect**: Fix in Onboarding.tsx (beforeinstallprompt) und FieldCalibration.tsx (field data loading)
- **NewMatch Gast-Validierung lockern**: Step 3 wird optional — wenn kein Gastname eingegeben, kann übersprungen werden
- **Upload-Fehlerbehandlung**: Wenn Supabase-Storage-Upload fehlschlägt, localStorage-Fallback mit Retry-Mechanismus beim nächsten Online-Event

**3. Mobile PWA Download-Integration**
- **Floating Install-Button**: In `AppLayout` für mobile Viewports — kleiner FAB unten rechts mit Download-Icon, wenn `beforeinstallprompt` verfügbar
- **iOS-Fallback**: Auf iOS zeigt der Button einen Modal mit Safari-Anleitung (Teilen → Zum Home-Bildschirm)
- **InstallGuide-Link** im Hamburger-Menü / Sidebar für alle Plattformen

**4. Responsive-Fixes**
- **TrackingPage**: Landscape-Lock-Hinweis für Portrait-Modus, größere Touch-Targets für Tracking-Buttons
- **FieldCalibration**: Touch-optimierte Punkt-Platzierung mit Vibrations-Feedback (`navigator.vibrate`), Zoom-Geste deaktivieren im Kalibrier-Bereich
- **NewMatch Stepper**: Stepper-Labels auf Mobile als Icons-only, voller Text ab `sm:`
- **MatchReport Tabs**: Horizontales Scrolling der Tabs auf kleinen Screens

**5. Prozess-Validierungen & UX-Hints**
- Vor Tracking-Start prüfen: Hat das Spiel Lineup-Einträge? Wenn nicht → Hinweis mit Link zu Match-Details
- Nach Upload → automatisch Match-Status auf "processing" setzen (bereits vorhanden, aber Fehlerfall absichern)
- Dashboard: "Nächster Schritt"-Card prominent oben anzeigen für User die den Prozess noch nicht abgeschlossen haben

### Technische Umsetzung

| Datei | Änderung |
|---|---|
| `src/components/MatchFlowGuide.tsx` | **Neu** — Kontextsensitiver Wizard-Banner mit Schritt-für-Schritt-Anleitung |
| `src/components/MobileInstallFab.tsx` | **Neu** — Floating Action Button für PWA-Installation auf Mobile |
| `src/pages/TrackingPage.tsx` | Fix: Substitution in DB persistieren, Landscape-Hinweis, Lineup-Check vor Start |
| `src/pages/Onboarding.tsx` | Fix: `useState` → `useEffect` für beforeinstallprompt |
| `src/pages/FieldCalibration.tsx` | Fix: `useState` → `useEffect`, Touch-Feedback, responsive Verbesserungen |
| `src/pages/NewMatch.tsx` | Fix: Gast-Aufstellung optional machen, Stepper responsive |
| `src/pages/MatchReport.tsx` | Tabs horizontal scrollbar auf Mobile |
| `src/pages/Dashboard.tsx` | MatchFlowGuide einbinden, MobileInstallFab einbinden |
| `src/components/AppLayout.tsx` | MobileInstallFab + Install-Guide Link in Navigation |

### Kein DB-Schema nötig
Alle benötigten Spalten existieren bereits (`match_lineups.subbed_in_min`, `subbed_out_min`). Keine Migrationen erforderlich.

