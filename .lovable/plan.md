

# Pricing-Korrektur & Opt-in Benchmark-Feature

## 1. "API-Zugang" aus Pricing entfernen

**Problem**: PRO-Plan bewirbt "API-Zugang" — existiert nicht.

**Loesung**: Ersetzen durch ein realistisches Feature.
- `src/lib/i18n.tsx`: `landing.plan3f4` von "API-Zugang" → "Datenexport (CSV/JSON)" (DE) / "Data export (CSV/JSON)" (EN)
- `src/lib/constants.ts`: Keine Aenderung noetig (PLAN_CONFIG hat keine Feature-Listen)
- `src/components/UpgradeModal.tsx`: Keine Aenderung (zeigt nur maxMatches)

## 2. Pricing-Features praezisieren

- `landing.plan3f2`: "Alle Teams" → "Alle Vereinsteams" / "All club teams" — klarstellen dass NICHT vereinsuebergreifend
- `landing.plan2f2`: "2 Teams" → "2 Vereinsteams" / "2 club teams"

## 3. Opt-in Liga-Benchmark (Pro-Feature)

### Konzept
Vereine im Pro-Plan koennen sich freiwillig in einen anonymen Benchmark-Pool eintragen. Sie sehen dann ihre eigenen Werte (Pressing, Dominanz, Tempo) im Vergleich zum Liga-Durchschnitt aller teilnehmenden Vereine.

### Datenbank
- Neue Tabelle `benchmark_opt_ins`: `id`, `club_id`, `opted_in` (bool), `opted_in_at`, `league` (text)
- RLS: Vereine sehen nur eigenen Opt-in Status
- Neue View `benchmark_averages`: Aggregiert anonyme Durchschnitte aus `team_match_stats` + `analysis_results` fuer alle opted-in Clubs, gruppiert nach Liga — Superadmin-only SELECT auf Rohdaten, aber Aggregate via SECURITY DEFINER Function fuer Club-Members

### Security-Definer Function `get_league_benchmarks`
- Input: `_club_id`, `_league`
- Prueft ob Club opted-in ist
- Returned nur aggregierte Durchschnittswerte (AVG pressing, AVG possession, AVG distance etc.) — KEINE einzelnen Vereinsdaten
- Mindestens 5 teilnehmende Vereine in der Liga noetig, sonst "Nicht genug Daten"

### Frontend
- **Settings-Seite**: Opt-in Toggle "Am Liga-Benchmark teilnehmen" (nur Pro-Plan sichtbar)
- **TrendDashboard.tsx**: Neue Sektion "Liga-Vergleich" — eigene Werte vs Liga-Durchschnitt als Balkendiagramm
- **Pricing**: Neues Feature in PRO ersetzen: `landing.plan3f4` → "Liga-Benchmark" statt "Datenexport"

### DSGVO-Konformitaet
- Explizites Opt-in (kein Default-An)
- Nur aggregierte, anonyme Durchschnitte werden geteilt
- Kein Rueckschluss auf einzelne Vereine moeglich (Minimum 5 Teilnehmer)
- Opt-out jederzeit moeglich
- Datenschutzerklaerung muss ergaenzt werden (Hinweis in Legal-CMS)

---

## Dateien

| Datei | Aenderung |
|---|---|
| `src/lib/i18n.tsx` | Feature-Texte korrigieren (plan3f2, plan3f4, plan2f2) |
| `src/components/landing/PricingSection.tsx` | Keine Code-Aenderung (nutzt i18n keys) |
| DB-Migration | Neue Tabelle `benchmark_opt_ins` + RLS + Function `get_league_benchmarks` |
| `src/pages/Settings.tsx` | Benchmark Opt-in Toggle (Pro-only) |
| `src/pages/TrendDashboard.tsx` | Liga-Vergleich Sektion |
| `src/hooks/use-benchmark.ts` | **NEU** — Hook fuer Opt-in Status + Benchmark-Daten |

