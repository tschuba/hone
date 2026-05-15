# Hone — Finalisierte Requirements

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
| Präferenzen | Eigengewicht, Isometrie, Abwechslung, kein High-Impact (konfig.) |
| Ziele | Rückenschmerzen ↓, Gewicht/Bauchumfang ↓, Fitness ↑ |
| Auth-Setup | Authentik läuft bereits → OIDC-Integration ohne Zusatzaufwand |

---

## Nutzer-Profil (generisch — jeder User konfiguriert sein eigenes)

- Name, Email (oder via OIDC)
- Ziele (Muskelaufbau / Abnehmen / Fitness / Ausdauer — Mehrfachauswahl)
- Heimequipment (Mehrfachauswahl aus Liste)
- Gym-Equipment (optional, falls Gym genutzt)
- Körperliche Einschränkungen (Freitext + Auswahl: Knie / Schulter / Rücken / High-Impact ausschließen)
- Bevorzugte Trainingsarten (Eigengewicht / Isometrie / Geräte / Cardio)
- Trainingsziel-Zeitraum und Session-Länge Präferenz

---

## Rollen

| Rolle | Rechte |
| --- | --- |
| **Admin** | Nutzerverwaltung, Instanz-Konfiguration, globale Übungen verwalten, Tags/Kategorien verwalten, AI-Prompts konfigurieren, Registrierung an/aus |
| **Moderator** | Globale Übungen verwalten (erstellen, bearbeiten, Tags umbenennen) — keine Nutzerverwaltung |
| **User** | Eigene Übungen erstellen/bearbeiten/löschen, eigene Logs und Körperdaten, eigenes Profil |

**Rollen-Vergabe:** Primär über OIDC-Claims (Authentik-Gruppen → JWT → Hone-Rolle). Fallback: Admin vergibt Rollen manuell im Admin-Panel.

---

## Leitende Architekturprinzipien

**1. Kein Vendor Lock-in — nirgendwo.**
Jede externe Abhängigkeit ist durch Konfiguration austauschbar.
Kein proprietärer Service darf zur Laufzeitbedingung werden.

| Bereich | Ansatz |
| --- | --- |
| AI-Provider | Abstraktionsschicht — Ollama / OpenAI-kompatibel / Gemini / Anthropic via .env |
| Datenbank | PostgreSQL (open source, self-hostable, Standard-SQL) |
| Dateispeicher | Lokales Filesystem (Standard) oder S3-kompatibel (MinIO etc.) via .env |
| Email | Standard SMTP — beliebiger Anbieter oder eigener Mailserver |
| Auth | OIDC-first (Authentik, Keycloak, etc.) + lokaler Fallback (email + argon2) |
| Übungsdaten | Import-once aus Open-Source-Quellen → eigene PostgreSQL — keine Live-API-Abhängigkeit |
| Deployment | Docker Compose — läuft auf jedem Linux-Server |
| Datenexport | Vollexport aller Nutzerdaten als JSON/CSV jederzeit möglich |
| Protokoll | Standard REST API + OpenAPI-Spec — kein proprietäres Protokoll |

**2. App denkt — Nutzer trainiert.**

## Leitendes UX-Prinzip

**"App denkt — Nutzer trainiert."**

Die App trifft alle Entscheidungen basierend auf Profil, Zielen und Historie.
Der Nutzer muss NICHTS auswählen um zu trainieren — ein Tap reicht.
Anpassungen sind immer möglich, aber nie erzwungen.

- **Zero-Friction-Start:** Home-Screen zeigt sofort das heutige Workout mit einem Start-Button
- **Smart Defaults:** Zeit, Ort und Fokus vorausgefüllt aus Profil + Historie
- **Progressive Disclosure:** Optionen existieren, werden aber nie aufgezwungen
- **Onboarding in < 2 Minuten:** Nur das Nötigste zum Plan-Generieren, Rest optional später
- **Fehlertolerant:** "Heute nicht" und spontane Änderungen brechen nie den Plan

---

## Feature-Anforderungen

### MVP — Must Have

| # | Feature | Details |
| --- | --- | --- |
| 1 | **Multi-User Auth** | OIDC-first (Authentik/Keycloak/beliebig) + lokaler Fallback (email + argon2). Admin-Flag. Instanz: offene/Invite-Registrierung konfigurierbar. |
| 2 | **Nutzerprofil** | Ziele, Equipment (Home + Gym), Einschränkungen, Präferenzen — jederzeit änderbar |
| 2a | **Dynamische Ziele** | Ziele auf 3 Ebenen: Langfristig (Profil), Mesocyclus (4-Wochen-Fokus), Session (heute) |
| 2b | **Ziel-Reaktion** | Profiländerung → Hinweis "Plan anpassen?" → sofort oder beim nächsten Zyklus |
| 2c | **Session-Override** | Beim Training-Start: "Heute lieber..." → Workout-Anpassung ohne Planbruch |
| 3 | **Tages-Workout** | Zeigt nächstes Workout in Rotation — kein fixer Wochentag |
| 4 | **Trainingsort-Auswahl** | Beim Start: [Zuhause] [Gym] → Workout passt sich an verfügbares Equipment an |
| 5 | **Zeit-Auswahl** | Beim Start: [10 Min] [20 Min] [30 Min] [60 Min] |
| 6 | **Skalierbare Workouts** | Kern (funktioniert immer) + Schichten (je nach Zeit). Aufwärmen + Abkühlen skalieren mit. |
| 7 | **Aufwärmen & Abkühlen** | Automatisch vor/nach jedem Workout. Übungen aus CATEGORY=Aufwärmen/Abkühlen, passend zum Workout-Fokus. Skaliert mit verfügbarer Zeit. Regel-basierter Fallback wenn KI nicht verfügbar. |
| 8 | **Übungsanleitung** | Name (DE + EN), Ausführungsbeschreibung (Text), Bild, Tipps + häufige Fehler |
| 9 | **Knieschonung** | Übungen mit Knie-Flag (MODIFIER-Tag: Knieschonend), Varianten angeboten |
| 10 | **Impact-Filter** | Pro User einstellbar: High-Impact-Übungen ausschließen |
| 11 | **Mesocyclus-Planung** | 3-4 Wochen Plan, A/B/C Rotation, dann AI-generierter Folgeplan |
| 12 | **AI-Plangeneration** | Server-seitig via konfigurierbarem AI-Provider (.env). Async Job Queue (DB-basiert, Bun Worker, 30s Poll). Fallback: regel-basierte Tag-Filterung wenn KI nicht verfügbar. Beim Onboarding + alle 3-4 Wochen. AI-Prompts in DB (Admin konfigurierbar). |
| 13 | **Mesocyclus-Feedback** | Nach jeder Woche: Mehrfachauswahl ("zu leicht / genau richtig / zu schwer / abwechslungsreich / monoton") + optionaler Freitext. Kontext für nächste KI-Plangeneration. |
| 14 | **Aussetzen** | "Heute nicht" — Rotation setzt beim nächsten Training fort |
| 15 | **Motivations-Badge** | In-App Hinweis bei langem Aussetzen — nur in Post-Workout-Summary oder Weekly-Summary, nie im aktiven Training |
| 16 | **Trainings-Logging** | Sätze, Wiederholungen, Zeit pro Übung festhalten |
| 17 | **Fortschritts-Tracking** | Trainings-Streak, Volumen über Zeit, Aktivitäts-Kalender |
| 18 | **Körperdaten** | Gewicht + Bauchumfang manuell eintragen, Verlauf als Chart |
| 19 | **Offline-Training** | Service Worker cached aktives Workout — kein Internet nötig beim Training (iOS Safari 16+) |
| 20 | **Offline-Sync** | UUID-basierte Idempotenz. Sync beim App-Öffnen (iOS: kein Background Sync). Letzter Sync-Zeitstempel sichtbar. Nutzer kann Sync deaktivieren. Konflikt-Resolution: Client-Timestamp + Server-Deduplication. |
| 21 | **Hands-Free Modus** | Training ohne Handy-Blick: Web Audio API (Töne/Beeps, unterbricht keine Musik), Web Speech API (TTS, kostenlos, offline, Deutsch), Vibration API (Feature-Detection — nicht auf iOS). Auto-Advance, Countdown-Töne (10s / 5s / 3-2-1 / Ende). |
| 22 | **Screen Wake Lock** | Display bleibt während Training aktiv (iOS 16.4+, Feature-Detection) |
| 23 | **Audio-Modi** | Musik-Modus (Töne + Vibration), Vollmodus (Sprachführung via Web Speech API), Still (nur Vibration), Manuell (kein Auto-Advance). Nutzer wählt ob Vibration, Audio oder beides aktiv. |
| 24 | **Hands-Free Navigation** | Vollmodus: Gestensteuerung (Wischen vor/zurück, langer Druck = Pause). Manuell-Modus: 3-Punkt-Menü. Modi wechseln jederzeit über Einstellungs-Icon. |
| 25 | **Adaptive Übungsführung** | Führungs-Level pro Übung basiert auf Häufigkeit: Neu (vollständig), Bekannt (kurz), Vertraut (nur Name + Ton) |
| 26 | **Re-Familiarisierung** | Nach >3-4 Wochen ohne eine Übung: automatisch zurück auf "Bekannt"-Niveau + kurze Erinnerung |
| 27 | **Zeitbasierte Übungen** | Standard: zeitbasiert statt rep-basiert (hands-free-freundlich, ideal für Isometrie). Reps als Orientierungsrahmen: "Ziel 8-12 Klimmzüge in 45 Sek" |
| 28 | **Workout-Übersicht im Training** | Kompakter Fortschrittsbalken immer sichtbar ("4/7 Übungen"). Vollständige Liste (✓ erledigt / ▶ aktuell / ○ ausstehend) per Wisch/Tap erreichbar — schließt automatisch wenn Training weiterläuft. Hauptfokus bleibt stets auf aktueller Übung (70% Screen). |
| 29 | **Datenexport & GDPR** | Vollexport aller eigenen Daten als JSON/CSV jederzeit. Account-Löschung inkl. aller Logs (GDPR). |
| 30 | **Data Retention** | Trainings-Logs dauerhaft gespeichert. Admin kann instanz-weite Policy konfigurieren. Nutzer kann einzelne Trainings oder Zeiträume löschen. |

### Phase 2 — Should Have

| # | Feature | Details |
| --- | --- | --- |
| 31 | **Apple Health (Shortcuts)** | Nach Training: ein Tap öffnet iOS Shortcut → schreibt Typ/Dauer/kcal zu Apple Health. Einmalige Shortcut-Einrichtung durch Nutzer. |
| 32 | **Ernährungsplan** | AI-generiert, Kalorienziel, Makros, Vorlieben/Abneigungen |
| 33 | **Admin-Panel** | Nutzerverwaltung, Instanz-Einstellungen, Registrierung an/aus |

### Phase 3 — Optional (wenn Projekt wächst)

| # | Feature | Details |
| --- | --- | --- |
| 34 | **Capacitor-Wrapper (iOS)** | Gleicher Web-Code, native iOS-Shell → echter HealthKit-Zugriff ohne Workaround. Benötigt Apple Developer Account (99€/Jahr) oder Sideload. |
| 35 | **A/B-Testing AI-Pläne** | Für größere Nutzerbasis: verschiedene Plan-Strategien vergleichen |

### Explizit NICHT im Scope (MVP)

- Social-Features / Teilen / Community
- Push-Notifications (System-Level)
- Wearable-Integration (Apple Watch, Garmin etc.)
- Videoanleitungen

---

## UX — Trainings-Flow (Handy)

```
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
│ [Heute aussetzen]        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ AUFWÄRMEN 1: Schulter-   │  ← automatisch, passend zum Fokus
│ kreisen                  │
│ ████░░░  30 Sek          │
│        [Fertig ✓]        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ ÜBUNG 1: Dead Hang       │
│ (Totmannhängen)          │
│                          │
│ [Bild]                   │
│                          │
│ Hänge an der Stange,     │
│ Schultern aktiv halten.. │
│                          │
│ ████░░░  30 Sek          │
│                          │
│ ✓ Achte darauf:          │
│ • Schultern nicht        │
│   hochziehen             │
│                          │
│        [Fertig ✓]        │
└──────────────────────────┘
           │
           ▼ (alle Übungen)
           │
           ▼
┌──────────────────────────┐
│ ABKÜHLEN: ...            │  ← automatisch
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Training abgeschlossen!  │
│ Streak: 5 Trainings      │
│                          │
│ Volumen heute: 2.400kg   │
│ Diese Woche: 3/4         │
└──────────────────────────┘
```

---

## Technische Anforderungen

| Bereich | Entscheidung | Begründung |
| --- | --- | --- |
| Backend | TypeScript + Bun | ~50MB RAM (JVM wäre ~200MB+). Eine Sprache für Frontend + Backend. Pi-freundlich. |
| Frontend | SvelteKit (TypeScript) | TypeScript = eine Sprache für alles. SvelteKit kompakt, stark für PWA, offline-fähig. |
| Datenbank-ORM | PostgreSQL + Prisma | Prisma: typsicher, Row-Level Security via Middleware, exzellente DX |
| Deployment | Docker Compose + Coolify-kompatibel | Raspberry Pi 5 + NAS |
| AI | Abstraktionsschicht mit konfigurierbarem Provider | Kein Vendor Lock-in. Unterstützt: OpenAI-kompatible APIs (Ollama, Groq, OpenRouter, Mistral…) + Gemini + Anthropic. Standard: Ollama (lokal, kostenlos). |
| AI Queue | DB-basierte Async Job Queue, Bun Background Worker (30s Poll) | Kein Timeout-Risiko, Fallback auf Tag-basierte Regel-Rotation |
| Auth | OIDC-first (Authentik/Keycloak/beliebig) + lokaler Fallback | Kein Vendor Lock-in. Rollen via JWT-Claims. In OIDC-Modus: kein Passwort-Handling in Hone. |
| Passwort-Hashing | argon2 (nur lokaler Fallback) | Sicher, modern |
| Offline | Service Worker (SvelteKit PWA-Plugin), iOS Safari 16+ Mindestversion | Training ohne Internet |
| Offline-Sync | UUID-Idempotenz, Client-Timestamp, Server-Deduplication | Konflikt-sicher |
| Konfiguration | Umgebungsvariablen (.env) | Kein Hardcoding, deploy-tauglich |
| Lizenz | GPL v3 | Open Source, Copyleft |
| Sprache UI | Deutsch | Zielgruppe |
| Übungsnamen | Zweisprachig (DE + EN) | Gym-Konvention |
| Bilder | Statische Bilder, Server-hosted | Open-Source Übungsdatenbank |
| Performance | < 100KB JS (gzip), Lighthouse Performance ≥ 85 | Pi-freundlich, schnelle PWA |
| Skalierung | ~20 concurrent User auf Pi 5 / 8GB (dokumentiertes Limit) | Shared Ressourcen |
| JVM (Kotlin) | Bewusst ausgeschlossen | ~200MB RAM-Overhead auf Pi |
| Rust/Go | Nicht im MVP | TypeScript reicht vollständig, näher an Java |

---

## Design-System

| Element | Entscheidung |
| --- | --- |
| Stil | Dunkel, klar — "Calm meets Focus". Nicht verspielt, nicht steril. |
| Hintergrund | Slate-Dunkel (~#1a1a2e) — kein reines Schwarz, wirkt weniger hart |
| Akzentfarbe | Amber/Orange — eine einzige Farbe durchgehend (energetisch, nicht aggressiv) |
| Text | Warm-Weiß, nicht kalt |
| Typografie | Inter oder Geist (kostenlos, modern, lesbar) |
| Radius | 8–12px — leicht gerundet, nicht bubbly |
| Icons | Lucide Icons (Open Source, konsistent) |
| Token-Set | 3-4 Farben, 4 Typografie-Größen, 4px-Grid-Spacing |
| Kern-Komponenten | Button, Card, Timer-Display, Exercise-Card, Progress-Bar, Modal |

---

## Übungsdatenbank

### Quellen (kein Vendor Lock-in — Import-once-Strategie)

| Quelle | Lizenz | Übungen | Besonderheit |
| --- | --- | --- | --- |
| wger | GPL v3 + CC-BY-SA | 2.500+ | Deutsch + Englisch, Bilder |
| exercises.json (wrkout) | Public Domain | 2.500+ | 10.000+ Bilder, 3.500 Videos |
| free-exercise-db (yuhonas) | Public Domain | 800+ | Einfaches JSON, schnell importierbar |
| ExerciseDB | AGPL v3 | 11.000+ | Größte Sammlung, self-hostbar |

Alle Quellen werden **einmalig importiert** → eigene PostgreSQL. Keine Laufzeit-API-Abhängigkeit.
Bei Updates: erneuter Import + Merge. Manuelle Übungen jederzeit ergänzbar.

### Sichtbarkeit & Rechte

| Typ | Ersteller | Bearbeiten | Löschen | Sichtbar für |
| --- | --- | --- | --- | --- |
| Global | Admin / Moderator | Admin / Moderator | Admin (Soft Delete) | Alle User |
| Privat | User | nur Ersteller | Ersteller (Soft Delete) | nur Ersteller |

- Globale und private Übungen sind **optisch unterscheidbar** (z.B. Badge/Label)
- **Soft Delete:** 30-Tage-Gnadenfrist. In Logs referenzierte Übungen können nicht hart gelöscht werden.
- **Tag-Umbenennung:** Sicher — IDs bleiben erhalten, M:N-Zuordnungen nicht betroffen.

### Datenstruktur pro Übung

**Kern-Felder:**

- Name (DE + EN)
- Beschreibung / Ausführungsanleitung (DE + EN)
- Bild(er) (lokal gespeichert, nicht extern verlinkt)
- Herkunft (Import-Quelle, für Attribution)
- `is_global` Boolean
- `owner_id` (null bei globalen Übungen)

**Tag-Kategorien (M:N, mehrere Tags pro Kategorie möglich):**

| Kategorie | Beispiele |
| --- | --- |
| MUSCLE_GROUP | Latissimus, Core, Schultern, Bizeps, Rücken, Bauch, Gesäß, … |
| EQUIPMENT | Klimmzugstange, Rudergerät, Gymnastikmatte, Körpergewicht, Gym-Gerät, … |
| CATEGORY | Isometrie, Kraft, Ausdauer, Mobilität, **Aufwärmen, Abkühlen** |
| MODIFIER | Knieschonend, Low-Impact, High-Impact, Anfänger, Fortgeschritten |

**Filterlogik:** Equipment-Tags aus Nutzerprofil inkludieren, MODIFIER-Tags aus Ausschluss-Präferenzen exkludieren.

**Fallback (KI nicht verfügbar):**

- Aufwärmen: `CATEGORY=Aufwärmen` + passende MUSCLE_GROUP + User-Equipment-Filter
- Hauptteil: Tag-basierte Rotation aus vorhandenen Mesocyclus-Exercises
- Abkühlen: `CATEGORY=Abkühlen` + Ganzkörper oder passende MUSCLE_GROUP

---

## Sicherheit

| Bereich | Entscheidung |
| --- | --- |
| Authorization | Row-Level Security via Prisma Middleware auf allen Endpoints |
| Cross-User-Zugriff | Explizit ausgeschlossen auf jedem Endpoint |
| Passwort-Hashing | argon2 (nur im lokalen Fallback-Modus) |
| GDPR | delete-user Endpoint (löscht alle User-Daten), Datenschutzhinweis im MVP |
| Cookies | HTTP-only Cookies für JWT |
| Schema-Constraints | Prisma: reps > 0, duration 1–3600s, NOT NULL auf kritischen Feldern |

---

## Architektur-Entscheidungen

| Entscheidung | Wahl | Begründung |
| --- | --- | --- |
| Monolith vs. Microservices | **Monolith** | Einfacher, Pi-freundlich, ausreichend für ~20 concurrent User |
| Sync AI vs. Async | **Async Job Queue** | Kein Timeout-Risiko, Fallback möglich |
| AI Prompts | **In Datenbank** | Admin-konfigurierbar ohne Deployment |
| Skalierungslimit | **~20 concurrent User** auf Pi 5 / 8GB | Dokumentiert, ausreichend für self-hosted |
| iOS Offline-Sync | **Foreground Sync** | Background Sync nicht auf iOS Safari verfügbar |
| iOS Vibration | **Feature-Detection + Audio-Fallback** | Vibration API nicht auf iOS |

---

## Deployment-Ziel (Thomas' Setup)

```text
Raspberry Pi 5 (Coolify)
    ├── hone-frontend (SvelteKit PWA)
    ├── hone-backend (Bun API)
    └── PostgreSQL

ODER alternativ:
    NAS (DB) + Raspi (App-Logik)
    → via Docker Compose konfigurierbar

Auth: Authentik (bereits vorhanden) → OIDC-Integration
```

---

## Erfolgskriterien nach 4-6 Wochen (Referenznutzer Thomas)

- Subjektiv weniger / keine Rückenschmerzen im Alltag
- Gewicht und/oder Bauchumfang messbar reduziert
- Trainings-Adherence: 3x/Woche Durchschnitt erreicht
- App läuft stabil auf Raspberry Pi, auch offline nutzbar
