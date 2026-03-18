
Ziel: Ich würde das als kombiniertes Daten-, Sicherheits-, Legal- und UX-Upgrade umsetzen, damit das System Plausibilität aktiv prüft, rechtlich sauberer aufgestellt ist, ein echtes Superadmin-/Rechtekonzept bekommt und Trainer interaktiver geführt werden.

1. Audit-Ergebnis zum aktuellen Stand
- Plausibilitätsprüfung ist nur teilweise umgesetzt:
  - `src/lib/stats.ts` kappt Top-Speed lokal bei 45 km/h.
  - Aber `supabase/functions/process-tracking/index.ts` speichert Roh-Top-Speed ohne harte Plausibilitätslogik; daher kann 76,3 km/h aktuell durchrutschen.
  - Die KI erwähnt Ausreißer nur im Prompt von `analyze-performance`, aber UI/DB markieren solche Werte noch nicht systematisch.
- Was-wäre-wenn-Analyse ist noch nicht vorhanden.
- Rechtstexte sind nur teilweise vorhanden:
  - Routing für `/legal/:slug` existiert.
  - Admin-CMS für `legal_documents` existiert.
  - Im Footer sind nur Impressum, Datenschutz, AGB verlinkt.
  - Cookie-Banner, Widerruf, Haftungsausschluss etc. fehlen als UX/Flow.
- Rechtliche Absicherung ist noch nicht sauber genug:
  - `LegalPage` rendert HTML via `dangerouslySetInnerHTML`.
  - Auch AdminLegal erlaubt rohe HTML-Inhalte ohne Sanitizing-Hinweis/Schutz.
- Superadmin ist noch nicht sauber umgesetzt:
  - Es gibt nur `app_role = admin | moderator | user`.
  - `info@time2rise.de` ist im Code nicht als echter Superadmin hinterlegt.
  - Admin-Checks prüfen aktuell nur auf `admin`.
- Berechtigungskonzept für Vereine/Module/Pakete existiert noch nicht:
  - kein Tabellenmodell für Module, Paket-Rechte, User-spezifische Berechtigungen, Delegation.
- Der erste Auftrag ist nur teilweise erfolgreich:
  - Interaktive Match-Reports, Schwachstellen-Heatmap und Gegentor-Analyse sind vorhanden.
  - Aber Plausibilitätskontrolle, Legal-Komplettierung, Superadmin/RBAC und intelligentere Guidance fehlen noch.
  - Das Screenshot-Ziel „Analyse-Cockpit erweitern“ ist also nicht vollständig abgeschlossen.

2. Was ich bauen würde
A. Plausibilitäts- und Fehleranalyse für Trackingwerte
- Zentrale Plausibilitätslogik für Distanz, Top-Speed, Avg-Speed, Sprints, Minuten und Feldmaße.
- Regelset:
  - Top-Speed > ca. 45 km/h = Ausreißer
  - ungewöhnliche Sprint-/Distanz-Kombinationen markieren
  - Feldmaße vs. Kalibrierung prüfen
  - Hinweis auf mögliche Ursache: Platz zu klein kalibriert / falsche Maße / Tracking-Sprung
- Ausgabe:
  - Warnbadge in Dashboard, MatchReport, PlayerProfile
  - „Datenqualität“-Block mit Ursache, Schweregrad, empfohlener Korrektur
  - optional korrigierter Anzeige-Wert plus Rohwert-Hinweis
- Wichtig:
  - Plausibilitätsprüfung direkt im Verarbeitungsflow und zusätzlich im Frontend/AI-Report.

B. Was-wäre-wenn-Analyse als erste interaktive Version
- Erste Version als heuristische Coaching-Simulation, nicht als echte physikalische Prognose.
- Interaktive Karte:
  - Spieler per Position verschieben
  - Formation wechseln
  - Rollenfit, Balance, Schwachzonen und wahrscheinliche Effekte live erklären
- Startumfang auf Basis vorhandener Daten:
  - Positionsprofil pro Spieler aus Match-/Saisonwerten
  - Stärken/Schwächen je Rolle
  - Hinweise wie „mehr Zugriff im Zentrum“, „Außenverteidigung wird offener“, „Pressinglinie instabiler“
- Immer mit Hinweis:
  - KI-generiert
  - kann Fehler machen
  - ist Empfehlung, keine sichere Vorhersage

C. KI-Hinweise und Transparenz überall ergänzen
- In KI-Analyse, Reports, Gegentor-Analyse, Was-wäre-wenn:
  - fester Hinweis, dass Texte KI-generiert sind
  - Hinweis, dass KI Fehler machen kann
  - Kennzeichnung, ob Aussage auf echten Daten, indirekter Ableitung oder KI-Interpretation basiert

D. Rechtliche Absicherung ausbauen
- Vollständige rechtliche Rubriken als verwaltbare Dokumente:
  - Impressum
  - Datenschutz / DSGVO
  - AGB
  - Widerrufsbelehrung
  - Haftungsausschluss
  - Cookie-Richtlinie
  - optional: Auftragsverarbeitung / Tracking-Hinweise / Einwilligungsinfo
- Footer und Landing aktualisieren, damit alle Pflichtseiten erreichbar sind.
- Cookie-Banner einbauen:
  - essenziell vs. optional
  - Speicherung der Auswahl
  - saubere Verlinkung auf Cookie-/Datenschutzseite
- Sicherheits-/Legal-Fix:
  - HTML-Inhalte sanitizen, bevor sie gerendert werden
  - Admin-CMS mit Hinweis auf erlaubte HTML-Tags und sicherer Vorschau

E. Superadmin + Rechtekonzept
- `info@time2rise.de` als echter Superadmin.
- Dafür separates Rollen-/Rechtemodell statt nur normalem `admin`.
- Superadmin kann:
  - komplettes Backend administrieren
  - alle Legal-Dokumente pflegen
  - Module aktiv/inaktiv schalten
  - Module Vereinen/Nutzern zuordnen
  - paketabhängige Rechte definieren
  - festlegen, was Vereins-Admins sehen und dürfen
- Von dir bestätigte Zieltiefe:
  - paketabhängig
  - nur Tabs
  - pro Aktion
  - pro Nutzer

F. Modulares Berechtigungssystem
- Neues Modell:
  - Module/Kapazitäten
  - Paket → Standardrechte
  - Verein → Überschreibungen
  - Nutzer → Einzelrechte
- Beispiele:
  - Tracking sehen/nutzen
  - Reports generieren/exportieren
  - KI-Analyse verwenden
  - Spieler bearbeiten/löschen
  - Legal-Dokumente nur lesen oder pflegen
  - Admin-Panel-Bereiche einzeln freischalten
- UI:
  - Superadmin-Maske für Rechte-Matrix
  - Vereinsadmin sieht nur freigegebene Bereiche

3. Technische Umsetzung
Frontend
- `src/pages/Dashboard.tsx`
  - Datenqualitätswarnungen, Legal-/Consent-Hinweise, bessere Coach-Navigation
- `src/pages/MatchReport.tsx`
  - Plausibilitätswarnungen, Datenqualitätsmodul, KI-Hinweise
- `src/pages/PlayerProfile.tsx`
  - Ausreißerhinweise je Spieler
- `src/components/MatchFlowGuide.tsx`
  - stärkere Guidance für Fehler, Korrektur und nächste Schritte
- `src/components/ReportGenerator.tsx`
  - KI-Hinweis dauerhaft sichtbar
- `src/components/landing/Footer.tsx`
  - vollständige Legal-Links
- neue Komponenten:
  - CookieBanner
  - DataQualityBadge / DataQualityPanel
  - WhatIfBoard / FormationScenarioPanel
  - PermissionsMatrix

Backend / Datenmodell
- Rollenmodell erweitern:
  - `superadmin` ergänzen oder separates hochprivilegiertes Rechteflag
- neue Tabellen für:
  - Module
  - Paketrechte
  - Vereinsrechte
  - Nutzerrechte
- ggf. zusätzliche Datenfelder für Tracking-Plausibilität:
  - quality_score
  - anomaly_flags
  - suspected_cause
  - corrected_metrics / raw_metrics
- `legal_documents` um standardisierte Dokumenttypen erweitern, falls nötig

Edge Functions / Logik
- `process-tracking`
  - Ausreißer erkennen und markieren/korrigieren
- `analyze-performance`
  - Datenqualität explizit mit ausgeben
  - KI-Hinweis standardisiert ergänzen
- `admin-users`
  - Superadmin-Prüfung und Rechteverwaltung erweitern

4. Wichtige fachliche Einschätzungen
- 76,3 km/h ist mit hoher Wahrscheinlichkeit ein Tracking-/Kalibrierungsproblem; das ist technisch sehr gut prüfbar.
- Eine Was-wäre-wenn-Analyse ist machbar, aber zuerst nur als intelligente Empfehlung, nicht als belastbare Match-Simulation.
- Das aktuelle Legal-CMS ist ein guter Start, aber rechtlich noch nicht vollständig genug.
- Das aktuelle Admin-System ist eher ein einfacher Admin-Zugang, noch kein echtes Superadmin-/Delegationssystem.
- Der erste Auftrag wurde funktional erweitert, aber noch nicht vollständig „ordentlich und erfolgreich“ im Sinne deiner neuen Anforderungen abgeschlossen.

5. Empfohlene Reihenfolge
1. Plausibilitätsprüfung + Datenqualitätswarnungen
2. Legal-Komplettierung inkl. Footer + Cookie-Banner + sichere HTML-Ausgabe
3. Superadmin für `info@time2rise.de` sauber einführen
4. Rechte-/Modul-/Paketmodell aufbauen
5. Danach Was-wäre-wenn-Analyse mit interaktiver Karte
6. Guidance weiter ausbauen, damit Trainer schneller zu sinnvollen Aktionen kommen

Technische Details
- Kritischer Befund: `process-tracking` speichert aktuell unrealistische Geschwindigkeiten ohne harte Korrektur/Warnung.
- Kritischer Legal-Befund: `dangerouslySetInnerHTML` für Rechtstexte braucht Sanitizing.
- Kritischer RBAC-Befund: aktuelles Enum kennt keinen `superadmin`, Admin-Prüfungen basieren nur auf `admin`.
- Für dein gewünschtes Berechtigungskonzept braucht es sehr wahrscheinlich neue Rechte-Tabellen und angepasste RLS-/Serverprüfungen.
