# Hone — Architektur & Requirements

## Projektcharakter

**Projektname: Hone** — "Schärfe dich. Täglich."

Selbst-gehostete, multi-user Fitness-PWA als Open-Source-Projekt (GPL v3).
Jeder kann eine eigene Instanz betreiben. Konfigurierbar: offene Registrierung oder Invite-Only.
Thomas ist erster Nutzer und Projekttreiber — sein Profil ist der Referenzfall.

**GitHub-Projekt:** Public Repository, GPL v3, Docker-deploybar

---

## Referenzprofil (Thomas)

| Attribut | Wert |
| --- | --- |
| Gewicht / Größe | 109 kg / 190 cm (BMI ~30) |
| Alltag | Desk-Job, HomeOffice, 2 Kinder |
| Trainingsfrequenz | 3-4x/Woche zuhause + 1x/Woche Gym (wenn möglich) |
| Session-Länge | Standard 20-30 Min, flexibel 10-60 Min |
| Home-Equipment | Rudergerät, Klimmzugstange, Gymnastikmatte |
| Gym | Studio-Equipment (selten, ~1x/Woche) |
| Einschränkungen | Knieprobleme — hohe Last vermeiden |
| Präferenzen | Eigengewicht, Isometrie, Abwechslung, kein High-Impact |
| Ziele | Rückenschmerzen ↓, Gewicht/Bauchumfang ↓, Fitness ↑ |
| Auth-Setup | Authentik läuft bereits → OIDC-Integration ohne Zusatzaufwand |
| Infrastruktur | Raspberry Pi 5 (Coolify) + Ugreen NAS (DB + Backup) |

---

## Nutzer-Profil (generisch)

- Name, Email (oder via OIDC)
- Ziele (Muskelaufbau / Abnehmen / Fitness / Ausdauer — Mehrfachauswahl)
- Heimequipment (Mehrfachauswahl, **Pflichtfeld** — mindestens "Körpergewicht")
- Gym-Equipment (optional)
- Körperliche Einschränkungen (Auswahl: Knie / Schulter / Rücken / High-Impact + optionaler Freitext)
- Bevorzugte Trainingsarten (Eigengewicht / Isometrie / Geräte / Cardio)
- Session-Länge Präferenz

---

## Rollen

| Rolle | Rechte |
| --- | --- |
| **Admin** | Nutzerverwaltung, Instanz-Konfiguration, globale Übungen, Tags, AI-Prompts, Registrierung an/aus, Rate-Limits konfigurieren |
| **Moderator** | Globale Übungen verwalten (erstellen, bearbeiten, Tags umbenennen) — keine Nutzerverwaltung |
| **User** | Eigene Übungen, eigene Logs, eigenes Profil |

**Rollen-Vergabe:** OIDC-Claims (Authentik-Gruppen → JWT → Hone-Rolle). Fehlender Claim → Default: User (niemals Admin). Fallback: Admin vergibt Rollen manuell.

**Bootstrap:** Erster Admin wird über `BOOTSTRAP_ADMIN_EMAIL` in `.env` definiert. Notfall-Fallback: `bun run cli promote-admin --email <email>`.

---

## Leitende Architekturprinzipien

**1. Kein Vendor Lock-in — nirgendwo.**

| Bereich | Ansatz |
| --- | --- |
| AI-Provider | Abstraktionsschicht — Ollama / OpenAI-kompatibel / Gemini / Anthropic via .env |
| Datenbank | PostgreSQL (open source, self-hostable) |
| Dateispeicher | Lokales Filesystem oder S3-kompatibel (MinIO etc.) via .env |
| Email | Standard SMTP |
| Auth | OIDC-first + lokaler Fallback (email + argon2) |
| Übungsdaten | Import-once → eigene PostgreSQL — keine Live-API-Abhängigkeit |
| Deployment | Docker Compose — läuft auf jedem Linux-Server |
| Datenexport | Vollexport aller Nutzerdaten als JSON/CSV jederzeit |
| Protokoll | Standard REST API + OpenAPI-Spec |

**2. App denkt — Nutzer trainiert.**

Die App trifft alle Entscheidungen basierend auf Profil, Zielen und Historie.
Der Nutzer muss NICHTS auswählen um zu trainieren — ein Tap reicht.

- **Zero-Friction-Start:** Home-Screen zeigt sofort das heutige Workout
- **Smart Defaults:** Zeit, Ort und Fokus vorausgefüllt aus Profil + Historie
- **Progressive Disclosure:** Optionen existieren, werden aber nie aufgezwungen
- **Onboarding in < 2 Minuten:** Nur das Nötigste, Rest optional später
- **Fehlertolerant:** "Heute nicht" und spontane Änderungen brechen nie den Plan

---

## Onboarding-Flow (< 2 Minuten)

```text
Screen 1: Willkommen (~10 Sek)
Screen 2: Ziele — Mehrfachauswahl (~30 Sek)
Screen 3: Equipment — Pflichtfeld, min. "Körpergewicht" (~30 Sek)
Screen 4: Einschränkungen — optional, überspringbar (~20 Sek)
Screen 5: Plan wird generiert — Ladeanimation (~10-30 Sek)
```

Alles weitere (Gym-Equipment, Freitext-Einschränkungen, Session-Länge) kommt ins Profil — optional, später.
Wenn kein Equipment angegeben: Default Körpergewicht, transparent in UI kommuniziert.

---

## Feature-Anforderungen

### MVP — Must Have

| # | Feature | Details |
| --- | --- | --- |
| 1 | **Multi-User Auth** | OIDC-first + lokaler Fallback (email + argon2). Bootstrap via .env. Instanz: offene/Invite-Registrierung konfigurierbar. |
| 2 | **Nutzerprofil** | Ziele, Equipment (Home + Gym), Einschränkungen, Präferenzen — jederzeit änderbar |
| 2a | **Dynamische Ziele** | Ziele auf 3 Ebenen: Langfristig (Profil), Mesocyclus (4-Wochen-Fokus), Session (heute) |
| 2b | **Ziel-Reaktion** | Profiländerung → Hinweis "Plan anpassen?" → sofort oder beim nächsten Zyklus |
| 2c | **Session-Override** | Beim Training-Start: "Heute lieber..." (dezenter Link). Mehrfachauswahl: Fokus / Intensität / Typ. Nach 3 Overrides in Folge: "Plan anpassen?" |
| 3 | **Tages-Workout** | Zeigt nächstes Workout in Rotation — kein fixer Wochentag |
| 4 | **Trainingsort-Auswahl** | Beim Start: [Zuhause] [Gym] → Workout passt sich an Equipment an |
| 5 | **Zeit-Auswahl** | Beim Start: [10 Min] [20 Min] [30 Min] [60 Min] |
| 6 | **Skalierbare Workouts** | Kern (funktioniert immer) + Schichten (je nach Zeit). Aufwärmen + Abkühlen skalieren mit. |
| 7 | **Aufwärmen & Abkühlen** | Automatisch vor/nach jedem Workout. CATEGORY=Aufwärmen/Abkühlen, passend zum Fokus. Skaliert mit Zeit. Regel-basierter Fallback wenn KI nicht verfügbar. |
| 8 | **Übungsanleitung** | Name (DE + EN), Beschreibung, Bild (WebP), Tipps + häufige Fehler. 3 Führungs-Level: Neu (vollständig) / Bekannt (kurz) / Vertraut (nur Name + Ton) |
| 9 | **Knieschonung** | Übungen mit MODIFIER-Tag "Knieschonend". Unsichere Übungen via Pre-Filter ausgeschlossen — KI sieht sie nicht. |
| 10 | **Impact-Filter** | Pro User einstellbar: High-Impact ausschließen |
| 11 | **Mesocyclus-Planung** | 3-4 Wochen Plan ("dein aktueller Plan"), A/B/C Rotation, dann neuer Plan |
| 12 | **AI-Plangeneration** | Konfigurierbarer Provider (.env). Async via LISTEN/NOTIFY + 5-Min-Fallback-Poll. Regel-basierter Fallback wenn KI nicht verfügbar. AI-Prompts versioniert in DB. Rate-Limits konfigurierbar (Admin), alle deaktivierbar. |
| 13 | **AI Rate-Limiting** | Max. 1 Job gleichzeitig. Max. Tages-Pläne: konfigurierbar (Default 5). Cooldown: konfigurierbar (Default 60 Min). Feedback-Regenerierung: eigenes Limit (Default 1), zählt nicht gegen Tages-Limit. |
| 14 | **Plan-Anpassung** | Einzelne Übungen tauschen (gefilterte Alternativen). Plan neu generieren (Rate-Limit). Manuelles Workout aus DB bauen. |
| 15 | **Mesocyclus-Feedback** | Nach jeder Woche: Mehrfachauswahl ("zu leicht / genau richtig / zu schwer / abwechslungsreich / monoton") + optionaler Freitext. Kontext für nächste Plangeneration. |
| 16 | **Aussetzen** | "Heute nicht" — Rotation setzt beim nächsten Training fort |
| 17 | **Motivations-Badge** | In-App Hinweis bei langem Aussetzen — nur in Post-Workout-Summary oder Weekly-Summary, nie im aktiven Training |
| 18 | **Pausen zwischen Übungen** | Pause-Screen nach jeder Übung: Countdown, Vorschau nächste Übung, [Überspringen]. TTS: "Pause — 15 Sekunden. Nächste Übung: X." Hierarchie: WorkoutTemplateExercise.rest_seconds → exercise.suggested_rest_seconds (aus Import/Tag-Inferenz) → Profil-Default (konfigurierbar, Default 15 Sek). |
| 19 | **Trainings-Logging** | Sätze (Set-Tabelle), Dauer, optionale Reps pro Übung |
| 19 | **Fortschritts-Tracking** | Trainings-Streak, Volumen über Zeit, Aktivitäts-Kalender |
| 20 | **Körperdaten** | Gewicht + Bauchumfang manuell eintragen, Verlauf als Chart |
| 21 | **Offline-Training** | vite-plugin-pwa + Workbox. Cache-First: App-Shell, Bilder. Network-First+Fallback: aktives Workout, Profil. iOS Safari 14+ (Wake Lock ab 16.4 via Feature-Detection). |
| 22 | **Offline-Sync** | UUID-basierte Idempotenz. Sync beim App-Öffnen. Letzter Sync-Zeitstempel sichtbar. Nutzer kann Sync deaktivieren. Konflikt: Server gewinnt, Nutzer wird informiert. |
| 23 | **Hands-Free Modus** | Web Audio API (Töne, unterbricht keine Musik). Web Speech API (TTS, best-effort, Deutsch). Vibration API (Feature-Detection — kein iOS). Auto-Advance. Countdown-Töne (10s / 5s / 3-2-1 / Ende). |
| 24 | **Screen Wake Lock** | Feature-Detection. iOS 16.4+: automatisch. iOS 14/15: einmaliger UI-Hinweis "Display anlassen". |
| 25 | **Audio-Einstellungen** | Unabhängige Toggles: Sprachansagen (TTS) / Töne+Beeps / Vibration / Auto-Advance. Kombinierbar (z.B. Musik + TTS gleichzeitig möglich — Audio-Ducking). Presets als Schnellauswahl. Mid-Workout wechselbar via Overlay — Timer läuft weiter. |
| 26 | **Hands-Free Navigation** | Auto-Advance AN: Dot-Indikator (minimaler Platz), vertikale Swipe-Gesten. Auto-Advance AUS: Fortschrittsbalken, 3-Punkt-Menü. Modi wechseln via Einstellungs-Icon. Vollständige Übungsliste per Tap erreichbar. |
| 27 | **Adaptive Übungsführung** | Führungs-Level: Neu (Bild groß + vollständige Beschreibung + Tipps) / Bekannt (Bild klein + Kurztext) / Vertraut (nur Name + Ton). Re-Familiarisierung nach >3-4 Wochen Pause. |
| 28 | **Zeitbasierte Übungen** | Standard: zeitbasiert (hands-free-freundlich, ideal für Isometrie). Reps als Orientierungsrahmen. |
| 29 | **Timer-Display** | 80-96px Schriftgröße. Aktiv: Amber. Pause: 50% Opacity + Pause-Icon. Fertig: kurzes Grün-Flash → Auto-Advance oder [Fertig ✓]. |
| 30 | **Datenexport & GDPR** | Vollexport JSON/CSV jederzeit. Account-Löschung: alle User-Daten weg. Zu Global beförderte Übungen: bleiben, Attribution anonymisiert ("Instanz-Übung"). |
| 31 | **Data Retention** | Trainings-Logs dauerhaft. Admin kann instanz-weite Policy konfigurieren. Nutzer kann einzelne Trainings oder Zeiträume löschen. |

### Phase 2 — Should Have

| # | Feature | Details |
| --- | --- | --- |
| 32 | **Apple Health (Shortcuts)** | Nach Training: ein Tap → iOS Shortcut → schreibt Typ/Dauer/kcal zu Apple Health. |
| 33 | **Ernährungsplan** | AI-generiert, Kalorienziel, Makros, Vorlieben/Abneigungen |
| 34 | **Admin-Panel** | Nutzerverwaltung, Instanz-Einstellungen, Registrierung an/aus |
| 35 | **Light Mode** | System-Theming (Dark/Light). MVP: nur Dark. Nachrüstbar wenn CSS Tokens von Anfang an sauber. |

### Phase 3 — Optional

| # | Feature | Details |
| --- | --- | --- |
| 36 | **Capacitor-Wrapper (iOS)** | Nativer HealthKit-Zugriff. Benötigt Apple Developer Account (99€/Jahr). |
| 37 | **A/B-Testing AI-Pläne** | Für größere Nutzerbasis |

### Explizit NICHT im Scope (MVP)

- Social-Features / Teilen / Community
- Push-Notifications (System-Level)
- Wearable-Integration
- Videoanleitungen

---

## UX — Trainings-Flow (Handy)

```text
App öffnen
    │
    ▼
┌──────────────────────────┐
│ Hallo Thomas!            │
│ Heute: Workout B         │
│ Fokus: Rücken + Core     │
│                          │
│ Wo trainierst du?        │
│ [Zuhause] [Gym]          │
│                          │
│ Wie viel Zeit?           │
│ [10m] [20m] [30m] [60m] │
│                          │
│ Heute lieber was anderes?│  ← dezenter Link
│ [Heute aussetzen]        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ AUFWÄRMEN: Schulter-     │  ← automatisch, passend zum Fokus
│ kreisen  ●○○○○○○  1/7   │
│ ████░░░  30 Sek          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Dead Hang    ●●○○○○○ 2/7 │  ← Dot-Indikator (Auto-Advance AN)
│ Totmannhängen            │
│                          │
│ [Bild]                   │
│                          │
│ Hänge an der Stange,     │
│ Schultern aktiv halten.. │
│                          │
│      0:32                │  ← 80-96px, Amber
│                          │
│ • Schultern nicht        │
│   hochziehen             │
│                          │
│        [Fertig ✓]        │
└──────────────────────────┘
           │
           ▼ (alle Übungen)
           ▼
┌──────────────────────────┐
│ ABKÜHLEN: ...            │  ← automatisch
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Training abgeschlossen!  │
│ Streak: 5 Trainings      │
│ Volumen heute: 2.400kg   │
│ Diese Woche: 3/4         │
└──────────────────────────┘
```

---

## Domain-Modell

```text
Mesocyclus (3-4 Wochen Plan)
    └── WorkoutTemplate (z.B. "Workout A: Rücken + Core")
            └── WorkoutTemplateExercise (Übung X, Position 3, 45 Sek, 3 Sätze)

WorkoutSession (ein konkretes Training)
    ├── mesocyclus_id
    ├── workout_template_id
    └── ExerciseLog (eine Übung in dieser Session)
            └── Set (satz_nr, duration_sek, reps optional, abgeschlossen)
```

Alle Tabellen: `created_at`, `updated_at`, `deleted_at` (Soft Delete), `created_by`.

---

## Technische Anforderungen

| Bereich | Entscheidung | Begründung |
| --- | --- | --- |
| Backend | TypeScript + Bun | ~50MB RAM. Eine Sprache für alles. Pi-freundlich. |
| Frontend | SvelteKit (TypeScript) | Kompakt, stark für PWA, offline-fähig. |
| PWA | vite-plugin-pwa + Workbox | Pflicht ab Tag 1. Service Worker, Manifest, Caching-Strategie. |
| Datenbank-ORM | PostgreSQL + Prisma | Typsicher, Row-Level Security via Middleware + DB-Constraints |
| Authorization | Prisma Middleware + Defense-in-Depth | Jede Tabelle hat user_id NOT NULL. Integration-Tests prüfen Cross-User-Zugriff. |
| Deployment | Docker Compose + Coolify (Pi) | Raspberry Pi 5 + Ugreen NAS |
| AI | Abstraktionsschicht — konfigurierbarer Provider | Kein Vendor Lock-in. Standard: Ollama (lokal). |
| AI Queue | LISTEN/NOTIFY (sofort) + 5-Min-Fallback-Poll | Effizient, zuverlässig, kein Timeout-Risiko |
| Device-Services | Abstraktionsschicht für Browser-APIs | Wake Lock, Vibration, TTS hinter Service-Interface — Capacitor-ready |
| Auth | OIDC-first + lokaler Fallback | Rollen via JWT-Claims. BOOTSTRAP_ADMIN_EMAIL für erste Instanz. |
| Passwort-Hashing | argon2 (nur lokaler Fallback) | Sicher, modern |
| Offline | iOS 14+ Mindestversion, Wake Lock via Feature-Detection | Training ohne Internet |
| Offline-Sync | UUID-Idempotenz, Foreground Sync, Server gewinnt bei Konflikt | iOS-kompatibel |
| Bilder | WebP + JPEG-Fallback, max. 200KB, automatische Optimierung bei Upload | Lazy Loading, Skeleton-Placeholder, 50 Bilder im Cache |
| Suchfunktion | Nur bei Übungs-Verwaltung (Admin/Moderator) | Onboarding-Listen sind kurz + kuratiert |
| Konfiguration | .env | Kein Hardcoding |
| Lizenz | GPL v3 | Open Source, Copyleft |
| Sprache UI | Deutsch | Zielgruppe |
| Übungsnamen | Zweisprachig (DE + EN) | Gym-Konvention |
| Performance | < 150KB JS (gzip), Lighthouse ≥ 85 | Pi-freundlich |
| Skalierung | ~20 concurrent User auf Pi 5 / 8GB | Dokumentiertes Limit |
| Architektur | Monolith mit Modul-Grenzen | Router → Service → Repository → DB |

---

## Design-System

| Element | Entscheidung |
| --- | --- |
| Stil | Dunkel, klar — "Calm meets Focus". Nicht verspielt, nicht steril. |
| Hintergrund | Slate-Dunkel (~#1a1a2e) |
| Akzentfarbe | Amber/Orange — nur für interaktive Elemente (Buttons, Progress, Icons), nie für Fließtext. WCAG AA 3:1 für Nicht-Text. |
| Text | Warm-Weiß auf Dunkel (problemloses Kontrastverhältnis) |
| Typografie | Inter oder Geist |
| Radius | 8–12px |
| Icons | Lucide Icons (Open Source) |
| Token-Set | Farben (4), Typografie (4 Größen), Spacing (4px-Grid), States (hover/active/disabled), Transitions (150ms / 250ms), Schatten (1 Token) |
| Timer | 80-96px. Aktiv: Amber. Pause: 50% Opacity. Fertig: Grün-Flash. |
| Bilder | WebP, Lazy Loading, Skeleton-Placeholder, Offline-Fallback: Lucide-Icon |
| Dark Mode | MVP: nur Dark. Light Mode in Phase 2 via CSS Custom Properties nachrüstbar. |
| Kern-Komponenten | Button, Card, Timer-Display, Exercise-Card, Progress-Bar, Modal |

---

## AI-System

### Provider-Abstraktionsschicht

```typescript
interface AiProvider {
  generatePlan(input: GeneratePlanInput): Promise<GeneratePlanOutput>
}

type GeneratePlanInput = {
  profile: UserProfile
  availableExerciseIds: string[]  // nur gefilterte, sichere IDs
  feedback?: MesocyclusFeedback
  durationWeeks: number
}
```

Pre-Filter garantiert: KI bekommt nur Equipment-kompatible, einschränkungs-sichere Übungen.
Server validiert Output: alle zurückgegebenen IDs müssen in der gefilterten Liste sein.

### Prompt-Versionierung

```text
ai_prompts: id, type, content, version, is_active, created_by, created_at
```

Jede Änderung = neue Zeile. Rollback jederzeit. Audit-Log wer wann welche Version aktiviert hat.
Prompt-Injection-Schutz: strukturelle Trennung System/User-Daten + Input-Sanitization (max. 500 Zeichen, Steuerzeichen entfernen).

### Regel-Fallback (wenn KI nicht verfügbar)

Vollständige Engine — kein "zufällige Übungen":

1. Equipment-Filter
2. Einschränkungs-Filter (MODIFIER-Tags)
3. Muskelgruppen-Balance (A: Rücken+Core / B: Push / C: Pull+Mobility)
4. Progression (Woche 1 leichter als Woche 4 via MODIFIER-Tags)
5. Abwechslung (keine Übung zwei Sessions hintereinander)
6. Aufwärmen/Abkühlen (CATEGORY-Tags, passend zum Fokus)

---

## Übungsdatenbank

### Quellen (Import-once-Strategie, MVP)

| Quelle | Lizenz | Übungen | Status |
| --- | --- | --- | --- |
| wger | GPL v3 + CC-BY-SA | 2.500+ | MVP — Attribution in UI Pflicht |
| free-exercise-db (yuhonas) | Public Domain | 800+ | MVP |
| exercises.json (wrkout) | Public Domain | 2.500+ | MVP |
| ExerciseDB | AGPL v3 | 11.000+ | Ausgeschlossen — Lizenz-Kompatibilität unklar |

### Sichtbarkeit & Rechte

| Typ | Ersteller | Bearbeiten | Löschen | Sichtbar für |
| --- | --- | --- | --- | --- |
| Global | Admin / Moderator | Admin / Moderator | Admin (Soft Delete) | Alle User |
| Privat | User | nur Ersteller | Ersteller (Soft Delete) | nur Ersteller |

- Optisch unterscheidbar (Badge/Label)
- Soft Delete: 30-Tage-Gnadenfrist
- In Logs referenzierte Übungen: kein Harddelete
- Account-Löschung: zu Global beförderte Übungen bleiben, Attribution → "Instanz-Übung"

### Datenstruktur

**Kern-Felder:** Name (DE+EN), Beschreibung (DE+EN), Bilder (WebP, lokal), `is_global`, `owner_id`, `suggested_rest_seconds` (nullable — aus Import oder Tag-Inferenz)

**Quell-Zuordnung (M:N):**

```text
exercise_sources: exercise_id, source, external_id, imported_at
```

**Tag-Kategorien (M:N):**

| Kategorie | Beispiele |
| --- | --- |
| MUSCLE_GROUP | Latissimus, Core, Schultern, Rücken, … |
| EQUIPMENT | Klimmzugstange, Rudergerät, Körpergewicht, … |
| CATEGORY | Isometrie, Kraft, Mobilität, **Aufwärmen, Abkühlen** |
| MODIFIER | Knieschonend, Low-Impact, High-Impact, Anfänger, Fortgeschritten |

### Import & Migration

- **Merge-Strategie:** Exakter Name-Match → Duplikat. Fuzzy >85% → manuelle Prüfung. Kein Match → neue Übung.
- **Pausen-Import:** `rest_seconds` aus Quelle wenn vorhanden. Sonst Tag-Inferenz: Fortgeschritten→60s, Anfänger→20s, Isometrie→45s, große Muskelgruppen→60s. Kein Match → null.
- **Bild-Import:** automatisch zu WebP konvertiert, auf 200KB komprimiert.
- **Schema-Änderungen:** Expand-Contract-Pattern (neue Spalte nullable → parallel befüllen → alte entfernen).
- **CI-Schutz:** `prisma migrate diff --exit-code` prüft auf destructive Migrations.

---

## Sicherheit

| Bereich | Entscheidung |
| --- | --- |
| Authorization | Prisma Middleware + Defense-in-Depth (user_id NOT NULL, Integration-Tests) |
| JWT-Rollen | Fehlender Claim → Default: User. OIDC_ROLE_CLAIM, OIDC_ADMIN_VALUE per .env konfigurierbar. |
| Admin-Bootstrap | BOOTSTRAP_ADMIN_EMAIL in .env. Notfall: `bun run cli promote-admin` |
| CSRF | SameSite=Strict Cookie + Origin-Header-Prüfung auf allen nicht-GET-Requests |
| Passwort-Hashing | argon2 |
| Prompt-Injection | Strukturelle System/User-Trennung im Prompt + Input-Sanitization |
| GDPR | delete-user Endpoint, Datenschutzerklärung mit Backup-Retention transparent |
| Backup-PII | AI-Prompts enthalten keine PII (nur IDs/Tags). Backup-Retention per BACKUP_RETENTION_DAYS. |
| Schema-Constraints | reps > 0, duration 1–3600s, NOT NULL auf kritischen Feldern |
| Cookies | HTTP-only, Secure, SameSite=Strict |

---

## Monitoring & Observability

**MVP (minimal):**

- Strukturiertes JSON-Logging (level, timestamp, context, message)
- `GET /health` → `{ status, db, aiWorker, version }` — Coolify überwacht und startet neu

**Nicht im MVP:** Metriken, Dashboards, Alerting

---

## Build & Deploy

```text
Git Push
    │
    ▼
GitHub Actions
    ├── tsc --noEmit (Typecheck)
    ├── bun test
    ├── bun run build
    └── Docker Image → ghcr.io
                │
    Docker Image Update Notifier erkennt neue Version
                │
    Pushover-Benachrichtigung → Thomas
                │
    Manuelles Update via Coolify
                │
    Container Start: prisma migrate deploy → App
```

---

## Backup-Strategie

```yaml
# docker-compose.yml auf Ugreen NAS (neben DB)
backup:
  image: prodrigestivill/postgres-backup-local
  environment:
    POSTGRES_HOST: db
    SCHEDULE: "@daily"
    BACKUP_KEEP_DAYS: 30
    BACKUP_KEEP_WEEKS: 4
  volumes:
    - /backups:/backups
```

App und DB laufen getrennt (Pi + NAS) — Coolify built-in Backup greift nicht. Backup-Container läuft direkt auf dem NAS neben PostgreSQL.

---

## Architektur-Entscheidungen

Vollständige ADRs in `/docs/adr/`. Kurzübersicht:

| Entscheidung | Wahl | Begründung |
| --- | --- | --- |
| Monolith vs. Microservices | **Monolith mit Modul-Grenzen** | Pi-freundlich, ein Entwickler, ~20 User |
| AI: Sync vs. Async | **Async (LISTEN/NOTIFY + Fallback-Poll)** | Kein Timeout, Fallback möglich |
| AI-Prompts | **Versioniert in DB** | Admin-konfigurierbar, Rollback jederzeit |
| RLS | **Prisma Middleware + Defense-in-Depth** | Pragmatisch für Bun/Prisma-Stack |
| iOS Offline-Sync | **Foreground Sync** | Background Sync nicht auf iOS Safari |
| iOS Vibration | **Feature-Detection + Audio-Fallback** | Vibration API nicht auf iOS |
| iOS Wake Lock | **Feature-Detection** | Ab iOS 16.4, UI-Hinweis für ältere |
| Capacitor-Vorbereitung | **Device-Service-Abstraktionsschicht** | Phase-3-Integration ohne Refactor |
| Backup | **Backup-Container auf NAS** | App und DB auf getrennten Servern |
| Bild-Format | **WebP + automatische Optimierung** | Performance + einheitliche Qualität |
| Migrations | **Expand-Contract-Pattern** | Kein Datenverlust bei Schema-Änderungen |

---

## Deployment-Ziel (Thomas' Setup)

```text
Raspberry Pi 5 (Coolify)
    ├── hone-frontend (SvelteKit PWA)
    └── hone-backend (Bun API)

Ugreen NAS
    ├── PostgreSQL
    └── Backup-Container (prodrigestivill/postgres-backup-local)

Auth: Authentik (bereits vorhanden) → OIDC ohne Zusatzaufwand
```

---

## Erfolgskriterien nach 4-6 Wochen (Referenznutzer Thomas)

- Subjektiv weniger / keine Rückenschmerzen im Alltag
- Gewicht und/oder Bauchumfang messbar reduziert
- Trainings-Adherence: 3x/Woche Durchschnitt erreicht
- App läuft stabil auf Raspberry Pi, auch offline nutzbar
