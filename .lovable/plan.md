
Ja, aber nicht nur aus den 4 gesetzten Punkten allein.

Was die 4 Punkte heute leisten:
- Sie definieren die Perspektive des Spielfelds im Bild.
- Damit kann das System Pixelpositionen sauber auf das Feld projizieren.
- Sie liefern aber noch keinen sicheren Meter-Maßstab, wenn die reale Feldgröße unbekannt ist.

Wichtige Grenze:
- Aus einem einzelnen Foto mit 4 Ecken kann man die echte Länge/Breite nicht zuverlässig “erraten”, wenn keine bekannte Referenz im Bild steckt.
- Eckfahnen helfen für die Eck-Erkennung, aber nicht für die absolute Distanz, weil sie keine normierte Strecke vorgeben.

Was automatisch möglich ist:
1. Feldgröße aus bekannten Feldmustern ableiten
- Wenn Strafraum, Torraum, Mittelkreis, Elfmeterpunkt oder Tor sichtbar sind, kann man daraus auf Standardmaße schließen.
- Beispiel: Großfeld, Kleinfeld, Futsal als erkannte Vorlage.
- Dann kann Breite/Länge automatisch vorgeschlagen und eingetragen werden.

2. Feldgröße aus Referenzobjekten schätzen
- Sichtbares Tor ist sehr hilfreich, weil die Torbreite normiert ist.
- Auch Strafraum-/Torraum-Geometrie ist sehr nützlich.
- Das ist deutlich verlässlicher als nur die Eckfahnen.

3. Corner-/Linien-Erkennung kombinieren
- KI erkennt Ecken, Linien, Tor, Strafraum und Mittelkreis.
- Daraus wird eine wahrscheinlichste Feldvorlage berechnet.
- Ergebnis: automatische Vorbelegung mit Confidence statt reiner Hand-Eingabe.

Empfohlene Umsetzung:
1. Nach 4 Punkten oder nach Foto-Upload automatische “Feldtyp erkennen”-Analyse starten
- Erkennt: Großfeld 105x68, Jugendfeld, Kleinfeld, Futsal
- Trägt Maße als Vorschlag ein
- Nutzer kann korrigieren

2. Corner-Flag-Erkennung nur als Zusatz verwenden
- Gut, um Ecken stabiler zu finden
- Nicht als alleinige Basis für Metermaße

3. Vertrauensstufe anzeigen
- “Hohe Sicherheit”, wenn Tor + Strafraum sichtbar
- “Mittlere Sicherheit”, wenn nur Linienmuster sichtbar
- “Niedrige Sicherheit”, wenn nur Ecken/Teile des Felds sichtbar

4. Manuellen Fallback behalten
- Falls Bildausschnitt zu klein ist oder Linien fehlen
- Presets bleiben auswählbar

Konkrete Produktentscheidung:
- Vollautomatische exakte Distanzmessung nur aus 4 Punkten: nein, nicht verlässlich genug.
- Automatische Maß-Vorschläge anhand Feldmarkierungen und bekannter Geometrie: ja, sinnvoll und gut umsetzbar.
- Eckfahnen-Erkennung: ja, als Hilfe für die Eckbestimmung; für die reale Feldgröße nur begrenzt nützlich.

So würde ich es implementieren:
- Bestehende Eckerkennung erweitern um Erkennung von:
  - Tor
  - Strafraum
  - Torraum
  - Mittelkreis
  - Seitenlinien/Grundlinien
- Daraus Feldvorlage + Maße berechnen
- Maße automatisch in Breite/Länge eintragen
- Nutzer sieht “automatisch erkannt” + Confidence + manuellen Override

Technische Details:
- Frontend: `src/pages/FieldCalibration.tsx`
  - Nach erfolgreicher Ecksetzung automatische Maß-Vorschläge anzeigen
  - Preset-Auswahl weiter erlauben
  - Hinweistext: “Maße automatisch erkannt, bitte prüfen”
- Backend-Funktion: `supabase/functions/detect-field-corners/index.ts`
  - Zu `detect-field-layout` erweitern oder zweite Analysefunktion ergänzen
  - Rückgabe nicht nur `corners`, sondern z. B.:
    - `corners`
    - `suggestedDimensions`
    - `fieldType`
    - `confidence`
    - `detectedFeatures`
- Datenspeicherung:
  - Bestehende `calibration.width_m` / `height_m` weiterverwenden
  - Optional später um Metadaten wie `dimension_confidence` erweitern

Empfehlung für die Umsetzung:
- Ich würde nicht “automatisch einmessen aus 4 Punkten” bauen,
- sondern “automatisch Feldgröße vorschlagen aus Feldmarkierungen + bekannten Standards”.
- Das ist fachlich sauberer und in der Praxis deutlich zuverlässiger.

<lov-actions>
<lov-suggestion message="Implementiere die automatische Feldgrößen-Erkennung nach der Kalibrierung und teste den kompletten Ablauf auf dem Handy end-to-end.">Test this end-to-end</lov-suggestion>
<lov-suggestion message="Erweitere die bestehende Eckerkennung so, dass zusätzlich Tor, Strafraum, Mittelkreis und Feldtyp erkannt werden und Breite/Länge automatisch vorgeschlagen werden.">Auto-Feldgröße erkennen</lov-suggestion>
<lov-suggestion message="Füge in der Kalibrierung eine Confidence-Anzeige hinzu, damit automatisch erkannte Maße als hoch, mittel oder niedrig sicher markiert werden.">Confidence anzeigen</lov-suggestion>
<lov-suggestion message="Nutze sichtbare Tore und Strafraum-Markierungen als Referenz, um die automatische Maßschätzung robuster und genauer zu machen.">Tor als Referenz nutzen</lov-suggestion>
</lov-actions>
