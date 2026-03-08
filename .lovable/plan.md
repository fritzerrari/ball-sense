

## Plan: Registrierung absichern, Verkaufsseite erweitern, Installationsanleitungen & Admin-CMS

### Bestandsanalyse

- **Registrierung**: Existiert auf `/login` (Toggle Login/Registrierung). Grundlegend funktional, aber keine Passwort-Stärke-Anzeige, kein Captcha, keine AGB-Zustimmung, kein Rate-Limiting.
- **Verkauf/Sales**: Landing Page hat Features + Preise + Vergleichstabelle, aber keinen echten Checkout/Stripe-Integration. "Kostenlos testen" leitet nur zu `/login`.
- **Download/Installation**: Es gibt keine Installationsanleitung oder Download-Seite. PWA-Install-Prompt existiert nur im Dashboard.
- **Mobile Anleitung mit CMS**: Fehlt komplett.

---

### Paket A: Registrierung absichern

1. **Passwort-Stärke-Indikator** auf der Registrierungsseite (visueller Balken: schwach/mittel/stark)
2. **AGB-Checkbox** mit Link zu `/legal/agb` und `/legal/datenschutz` — Registrierung nur möglich wenn akzeptiert
3. **E-Mail-Validierung** verbessern (Regex + Fehlerhinweise)
4. **Rate-Limiting Hinweis** bei zu vielen fehlgeschlagenen Versuchen (clientseitig 5 Versuche, dann 60s Sperre)

### Paket B: Landing Page als Verkaufsseite erweitern

1. **"So funktioniert's"**-Sektion: 3-Schritt-Erklärung (Smartphones aufstellen → Spiel tracken → Report erhalten) mit Illustrationen/Icons
2. **Testimonials/Social Proof**-Sektion (Platzhalter für Zitate)
3. **FAQ-Sektion** mit Accordion (häufige Fragen zu Datenschutz, Kompatibilität, etc.)
4. **CTA-Banner** zwischen Sektionen ("Jetzt 30 Tage kostenlos testen")
5. **Footer erweitern**: Links zu Impressum, Datenschutz, AGB, Kontakt, Installationsanleitung
6. **Nav erweitern**: Link "So funktioniert's", "Installation"

### Paket C: Installationsanleitung-System

**Neue DB-Tabelle `device_guides`:**
- `id`, `brand` (text), `model` (text), `guide_chapters` (jsonb — Array aus {title, text, image_url}), `active` (boolean), `created_at`, `updated_at`, `updated_by`

**Öffentliche Seite `/install`:**
- Dropdown "Marke" → Dropdown "Modell" (gefiltert)
- Zeigt Schritt-für-Schritt-Anleitung mit Bildern und Text pro Kapitel
- Fallback: generische Anleitung wenn Modell nicht gefunden
- Kein Hinweis auf interne Technologie (YOLOv8 etc.) — nur Anwender-Sprache

**Admin-Tab "Anleitungen":**
- CRUD für Geräte-Anleitungen (Marke + Modell als Dropdowns/Freitext)
- Pro Kapitel: Titel, Text (Textarea), Bild-Upload (Storage Bucket `guide-images`)
- "Anleitung generieren"-Button: Ruft AI Edge Function auf, die eine Standard-Anleitung für ein neues Gerät generiert (basierend auf generischer Vorlage)
- Toggle aktiv/inaktiv
- Kapitel per Drag oder Reihenfolge-Nummer sortierbar

**Storage Bucket:** `guide-images` (public) für Anleitungsbilder

### Paket D: Generische Nutzungsanleitung

Erstelle eine Standard-Anleitung mit ~5 Kapiteln, die initial als Seed-Daten eingefügt wird:
1. "App installieren" — PWA zum Homescreen hinzufügen
2. "Kamera-Zugriff erlauben" — Berechtigungen im Browser
3. "Smartphones positionieren" — Wo am Spielfeldrand aufstellen
4. "Tracking starten" — Button drücken, Spieler werden erkannt
5. "Nach dem Spiel" — Daten werden automatisch übertragen

---

### Technische Umsetzung

**Neue DB-Migration:**
- Tabelle `device_guides` mit RLS (Admins: CRUD, öffentlich: SELECT where active=true)
- Storage Bucket `guide-images`

**Neue Dateien:**
- `src/pages/InstallGuide.tsx` — öffentliche Installationsseite mit Marke/Modell-Auswahl
- `src/components/AdminGuides.tsx` — Admin-Tab für Anleitungsverwaltung mit KI-Generierung

**Geänderte Dateien:**
- `src/pages/Login.tsx` — Passwort-Stärke, AGB-Checkbox, Rate-Limiting
- `src/pages/LandingPage.tsx` — Neue Sektionen (So funktioniert's, FAQ, Testimonials, erweiterter Footer)
- `src/pages/Admin.tsx` — Neuer Tab "Anleitungen"
- `src/App.tsx` — Route `/install`
- `supabase/functions/ai-assistant/index.ts` — Neuer Modus `generate-guide` für automatische Anleitungsgenerierung

**Empfohlene Reihenfolge:**
1. DB-Migration + Storage Bucket
2. Login absichern
3. Landing Page erweitern
4. Installationsanleitung (öffentlich + Admin-CMS)

