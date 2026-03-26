

# Walkie-Talkie, Slider-Fix & Textkorrektur

## 1. Walkie-Talkie / Intercom zwischen Trainer und Kameramann

### Konzept
WebRTC-basierte Push-to-Talk Kommunikation ueber die bestehende `camera_access_sessions` Infrastruktur. Supabase Realtime dient als Signaling-Kanal fuer WebRTC Peer-Connection-Aufbau.

### Architektur
```text
Trainer (Admin)                    Helfer (Kamera)
     │                                  │
     ├─ Push-to-Talk Button             │
     │   ▼                              │
     ├─ MediaRecorder (audio)           │
     │   ▼                              │
     ├─ WebRTC DataChannel / Audio ◄──► WebRTC Audio
     │                                  │
     └─ Supabase Realtime (signaling)   │
         - ICE candidates               │
         - SDP offer/answer             │
```

### Teilnehmer-Modell
- **1:1**: Trainer ↔ Kameramann (ueber session_id)
- **Gruppe**: Trainer + alle aktiven Kameraleute eines Matches (ueber match_id als Channel)
- Kameramann 1 ↔ Kameramann 2 ebenfalls moeglich

### Implementation
- **Neue Komponente**: `src/components/WalkieTalkie.tsx`
  - Push-to-Talk Button (halten = sprechen, loslassen = stoppen)
  - Visuelles Feedback: Pulsierender Ring wenn jemand spricht, Lautsprecher-Icon wenn Nachricht empfangen
  - Teilnehmerliste mit Online-Status
  - Mute/Unmute Toggle
- **WebRTC Signaling via Supabase Realtime**: Nutze `supabase.channel(`walkie-${matchId}`)` fuer SDP/ICE Exchange — kein neuer Edge Function noetig
- **Integration in `CameraTrackingPage.tsx`**: Floating Button unten links, oeffnet Walkie-Talkie Panel
- **Integration in `CameraRemotePanel.tsx`**: Trainer sieht gleichen Walkie-Talkie Button

### Kein neuer Edge Function noetig — WebRTC Audio laeuft Peer-to-Peer nach Signaling. Keine DB-Migration noetig — Realtime Channel ist ephemer.

---

## 2. WhyFieldIQ Text grammatikalisch korrigieren

**Problem**: "Andere zeigen dir was passiert ist. Wir zeigen dir warum." — grammatikalisch fehlt ein Komma, und stilistisch ist der Satz ausbaufaehig.

**Neuer Text (DE)**:
> Andere zeigen dir, **was** passiert ist.
> Wir zeigen dir, **warum**.

Alternativ staerker:
> Die anderen liefern Zahlen.
> **Wir liefern Antworten.**

Oder:
> Statistik sagt dir was.
> **FieldIQ sagt dir warum.**

Ich werde die praegnanteste Variante umsetzen: Kommata hinzufuegen fuer grammatikalische Korrektheit und den Claim scherfer formulieren.

**Datei**: `src/components/landing/WhyFieldIQ.tsx` (Zeilen 39-44)

---

## 3. HeroSlider Slides visuell aktualisieren

**Problem**: Die Slides wurden im letzten Update nur bei Slide 3 (Coach Report) geaendert. Slide 1 (Tracking) und Slide 2 (Kalibrierung) sehen identisch aus wie vorher. Der User erwartet sichtbare Aenderungen.

### Slide 1 (Tracking) — Verbesserungen:
- Spieler-Dots von `w-3.5 h-3.5` auf `w-5 h-5` vergroessern mit besseren Team-Farben (Cyan vs Rot statt primary/destructive)
- LIVE-Badge prominenter: Groesserer Text, gruener Hintergrund-Pill
- Kamera-Icons am Rand groesser und mit Beschriftung ("Cam 1", "Cam 2", "Cam 3")
- Heatmap-Zentrum staerker betonen

### Slide 2 (Kalibrierung) — Verbesserungen:
- Phone-Mockup realistischer mit Notch/Dynamic Island
- Fortschrittsbalken (2/4 Punkte kalibriert)
- Animierte Linie die zum naechsten Punkt fuehrt

### Slide 3 (Coach Report) — bereits aktualisiert, kleinere Polishing:
- Training-Empfehlung als Teaser-Zeile hinzufuegen

**Datei**: `src/components/landing/HeroSlider.tsx`

---

## Dateien

| Datei | Aenderung |
|---|---|
| `src/components/WalkieTalkie.tsx` | **NEU** — WebRTC Push-to-Talk Komponente |
| `src/pages/CameraTrackingPage.tsx` | WalkieTalkie einbinden (Floating Button) |
| `src/components/CameraRemotePanel.tsx` | WalkieTalkie einbinden (Trainer-Seite) |
| `src/components/landing/WhyFieldIQ.tsx` | Grammatik-Fix + staerkerer Claim |
| `src/components/landing/HeroSlider.tsx` | Alle 3 Slides visuell aufwerten |

Keine DB-Migration noetig.

