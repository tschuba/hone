# Hone — Architektur-Review (Runde 2)

**Datum:** 2026-05-16
**Basis:** ARCHITECTURE.md nach Runde-1-Überarbeitung
**Reviewer-Personas:** Software Architect · Backend Architect · Frontend Developer · Mobile App Builder · UI Designer · AI Engineer · Senior Developer

---

## Zusammenfassung

Die überarbeitete Architektur zeigt deutliche Reife gegenüber Runde 1: API-Kontrakt (OpenAPI-Spec), State-Management (Svelte 5 Runes), Typ-Sharing, AI-Queue-Design, iOS-Feature-Matrix und viele andere vorherige Blocker sind sauber gelöst. Das Fundament ist solide.

Die Runde-2-Findings sind strukturell tiefer: Weniger "Konzept fehlt komplett", mehr "Konzept vorhanden, aber Implementierungsvertrag unvollständig". Die kritischsten neuen Findings betreffen **implizite Verträge** (Transaktionsgrenzen, Modul-Abhängigkeitsgraph, Prisma-$transaction-Lücke, SvelteKit-Modus, Dexie-Schema-Versionierung) und **operative Lücken** (Secrets-Management, Runtime-Env-Validierung, TTS-Resilienz auf iOS).

**11 Blocker** — alle lösbar vor dem ersten Commit, kein Architektur-Umbau erforderlich.

---

## Priorisierte Empfehlungen

### 🔴 Blocker — Vor dem ersten Commit

| # | Persona | Thema | Kurzfassung |
| --- | --- | --- | --- |
| B1 | Software Architect | **Transaktionsgrenzen-Strategie** | Kein definiertes Pattern wenn `WorkoutSessionService` mehrere Repos aufruft. `WorkoutSession + ai_jobs` muss atomar sein. ADR 010 fehlt: Repository-Methoden mit optionalem `tx: PrismaTransaction`-Parameter. |
| B2 | Software Architect | **Modul-Dependency-Graph** | Horizontale Schichten (Router→Service→Repo) sind definiert, vertikale Modul-zu-Modul-Abhängigkeiten nicht. `eslint-plugin-boundaries` ist halb konfiguriert ohne gerichteten azyklischen Graphen. Zirkuläre Abhängigkeiten entstehen schleichend. |
| B3 | Backend Architect | **Prisma Middleware in $transaction** | Auth-Middleware greift bei interaktiven `$transaction`-Calls u.U. nicht — abhängig von Prisma-Version. Eine vergessene Middleware-Registrierung oder ein Prisma-Upgrade kann zu stiller Daten-Isolation-Verletzung führen. Integrations-Test je Model ist Pflicht. |
| B4 | Frontend Developer | **SvelteKit-Modus (SSR vs. SPA)** | SSR oder `adapter-static`/SPA-Mode ist nicht festgelegt. SSR mit personalisierten Workout-Daten und Offline-First-Anforderung ist ein Widerspruch — Service Worker kann personalisierte HTML-Responses nicht korrekt cachen. Beeinflusst Workbox-Konfiguration und gesamten `load()`-Einsatz. |
| B5 | Frontend Developer | **Dexie.js Schema-Versionierung** | IndexedDB-Migrationen sind irreversibel. Kein Versions-Konzept für `workout_queue`, `current_workout`, `sync_meta`. Nutzer mit Offline-Daten in Schema-V1 können bei App-Update in V2 in unbootable State geraten. Muss vor erster IndexedDB-Nutzung definiert sein. |
| B6 | Mobile App Builder | **TTS-Resilienz auf iOS** | `speechSynthesis` auf iOS hat bekannte Bugs: stuck utterance, Abbruch bei Hintergrundwechsel, `getVoices()` gibt bei erstem Aufruf leeres Array. Kein `cancel()` vor `speak()` führt zu gestapelten Utterances. Kein `voiceschanged`-Handler → deutsche Stimme lädt nicht zuverlässig. |
| B7 | UI Designer | **Amber-Kontrast WCAG AA** | "≥ 4.5:1 beim Design-Prototyp" ist Absichtserklärung, nicht Spezifikation. `#f59e0b` auf `#1a1a2e` erreicht ~3.8:1 — Fail. Token `--color-accent` fehlt im Inventar. Kein Hex-Wert + kein WCAG-Tool-Nachweis = interaktive Ebene unspezifiziert. |
| B8 | AI Engineer | **JSON-Output-Enforcement** | "JSON-Schema im System-Prompt" ohne Enforcement-Mechanismus. Bei Ollama 3B-Modellen ist JSON-Mode nicht garantiert. Kein Ajv-Validator zwischen LLM-Response und semantischer Validierung definiert. Partieller JSON / Markdown-umwickelter JSON → `invalid_output`-Pfad nicht spezifiziert. |
| B9 | AI Engineer | **Injection-Längengrenze + Alert** | Aktuelle Maßnahme "geloggt + abgeschnitten" ist zu schwach. Kein Zeichenlimit auf Freitext-Inputs (50.000-Zeichen-Feedback möglich). Lexikalisches Pattern-Match umgehbar via Homoglyphen, Base64, Zeilenumbrüche. Erkannter Injection-Versuch muss Admin-Alert auslösen und Generation abbrechen. |
| B10 | Senior Developer | **Runtime-Env-Validierung** | 30+ Pflicht-Variablen ohne Laufzeit-Schema-Validierung. Fehlender `SMTP_HOST` oder falscher `S3_REGION` → Container startet, scheitert erst beim ersten Use. Zod-Schema in `src/config.ts` mit Fail-Fast beim Start. Bedingt optionale Variablen (z.B. `S3_*` nur wenn `STORAGE_TYPE=s3`) explizit modellieren. |
| B11 | Senior Developer | **Secret-Scanning + Pre-Commit-Hooks** | Kein Secret-Scanning in CI-Pipeline für ein Open-Source-Projekt mit Contributor-Onboarding. Kein Pre-Commit-Hook (Biome check + tsc) in `setup.sh` verankert. Fehler erst in CI statt lokal → unnötiger Feedback-Loop. `JWT_SECRET`, `OIDC_CLIENT_SECRET` im `.env` ohne Commit-Schutz-Warnung. |

---

### 🟠 High Priority — Vor der ersten User-Story

| # | Persona | Thema | Kurzfassung |
| --- | --- | --- | --- |
| H1 | Software Architect | **Cross-Cutting-Concerns explizit verorten** | Logging-Initialisierung, Error-Normalisierung, Rate-Limiting, Auth-Middleware-Reihenfolge: Wo genau im Stack? Ohne Festlegung implementiert jedes Modul diese anders — klassisches Lasagna-Antipattern. |
| H2 | Software Architect | **Dead-Letter-Recovery-Pfad für ai_jobs** | `dead`-Status ist definiert, Recovery-Pfad nicht: Admin-sichtbar? Manueller Retry? Automatischer Cleanup nach N Tagen? Ohne das akkumulieren `dead`-Jobs stillschweigend. |
| H3 | Software Architect | **Aggregate-Roots benennen** | Domain-Modell verwendet Aggregat-Sprache ohne explizite Aggregate-Roots. `WorkoutSession` oder `Mesocyclus` als Root? Cross-Aggregate-Zugriffe nur via Service-Layer — nicht dokumentiert. |
| H4 | Backend Architect | **OIDC Backchannel-Logout** | Authentik unterstützt Backchannel-Logout. Ohne `/api/v1/auth/backchannel-logout`-Endpoint bleibt Hone blind bei extern initiierten Session-Terminations (Passwort-Reset, Account-Sperrung in Authentik). |
| H5 | Backend Architect | **Session-Tabelle: Indizes + Cleanup** | Kein `@@index([userId, expiresAt])`, kein `@@index([expiresAt])`. Ohne Cleanup-Job (z.B. alle 15 Min `DELETE WHERE expires_at < NOW()`) akkumulieren abgelaufene Sessions und verlangsamen jeden Auth-Check. |
| H6 | Backend Architect | **Rate-Limiting: Sliding-Window + Schema** | Fixed-Window erlaubt 200 Req in 1 Sekunde an Fenstergrenzen. Schema der Rate-Limit-Tabelle fehlt. Response-Headers `X-RateLimit-Limit/Remaining/Retry-After` fehlen. DB-basiert machbar, aber Burst-Anfälligkeit ohne Sliding-Window. |
| H7 | Backend Architect | **Maximale Session-Gültigkeitsdauer** | "Rollen-Änderungen wirken beim nächsten Request" → bei 60-Min-Workout bleibt ein downgrade-User bis zu 60 Min voll privilegiert. `max_age`-Feld in `sessions`: 8h User / 1h Admin. |
| H8 | Backend Architect | **CSRF-Token (Double-Submit-Cookie)** | `SameSite=Strict` allein schützt nicht bei Top-Level-Navigation und älteren WebViews (PWA-Kontext). Double-Submit-Cookie ergänzend zu `SameSite=Strict`, nicht ersetzend. Besonders relevant für PWA-Context. |
| H9 | Frontend Developer | **SW Training-aktiv-Kommunikationskanal** | "Update verzögern während Training" ohne definierten Mechanismus. Wer hält den `waiting` SW? `postMessage({type: 'WORKOUT_ACTIVE'})` oder IndexedDB-Flag? Ohne Spezifikation wird das ad-hoc gelöst und ist schwer zu testen. |
| H10 | Frontend Developer | **$state-Klassen Instanziierung + Scope** | `WorkoutSession` als $state-Klasse: Singleton im Module-Scope (gefährlich bei SSR), oder `setContext/getContext` im `+layout.svelte`? Bei Navigation: explizit in IndexedDB persistieren vor Route-Wechsel. Lifecycle muss definiert sein. |
| H11 | Frontend Developer | **Komponenten-Kompositions-Hierarchie** | Inventar listet Komponenten ohne Kompositions-Hierarchie. Wer owned `TimerState` während `AudioSettingsOverlay` offen ist? Ist `PauseScreen` eigene Route oder Modal? `WorkoutSummary`: Route oder Overlay? Beeinflusst State-Transfer und SW-URL-Caching. |
| H12 | Mobile App Builder | **PWA-Install-Detection + Banner-Timing** | `navigator.standalone` und `matchMedia('(display-mode: standalone)')` fehlen — App weiß nicht, ob sie bereits installiert ist. Banner-State in `localStorage` statt `sync_meta` (IndexedDB). Erwägen: Hinweis beim ersten Öffnen, nicht erst nach Training. |
| H13 | Mobile App Builder | **Wake-Lock-Fallback für iOS <16.4 entscheiden** | "UI-Hinweis Display anlassen" ist kein Software-Fallback. 1x1px-Video-Workaround (funktioniert auf iOS 14/15) als Alternative prüfen. Architektur muss Entscheidung treffen, nicht offen lassen. |
| H14 | Mobile App Builder | **IndexedDB-Recovery-Pfad nach iOS-15.4-Bug** | Sentinel-Check beim App-Start ist definiert, Recovery nicht: User-Notification, Server-Resync-Trigger, Memory-Fallback für laufendes Training? `current_workout` braucht definierte Lebensdauer und Invalidierungsstrategie. |
| H15 | UI Designer | **Typography-Token vervollständigen** | Konkrete `rem`-Werte, `line-height`, `font-weight` für alle 4 Skalen-Stufen fehlen. Timer hat `clamp()` — Body/Large/XL nicht. Entwickler erfinden eigene `font-size`-Werte im Component-CSS. |
| H16 | UI Designer | **Fokus-Ring spezifizieren** | `--color-focus-ring` fehlt als Token. `--shadow-sm` für Fokus-Ringe reicht nicht. Auf allen 3 Surface-Ebenen sichtbar? `outline-offset: 3px` + Doppel-Ring (WCAG 2.4.11). |
| H17 | UI Designer | **State-Layer-Token-Set** | Hover, Pressed, Disabled fehlen als Token. Ohne `--color-interactive-hover/pressed/disabled` erfindet jeder Entwickler eigene Hover-Zustände (`opacity: 0.7` etc.) — inkonsistentes Feedback-System. |
| H18 | UI Designer | **Grün-Flash-Motion spezifizieren** | Dauer, Scope (Timer-Display oder ganzer Screen), Keyframe-Typ, `prefers-reduced-motion`-Fallback fehlen. Der Grün-Flash ist der emotionale Höhepunkt eines abgeschlossenen Trainings. |
| H19 | AI Engineer | **Fallback-Plan durch dieselbe Validierungs-Pipeline** | Output-Validierungsschritte 1–4 gelten laut Dokument für KI-Output — sind sie für den Regel-Fallback verpflichtend? Falls nicht: Fallback kann invalide Pläne produzieren. Gemeinsame `validatePlan()`-Funktion für beide Pfade. |
| H20 | AI Engineer | **RAG-Grundentscheidungen für Phase 2** | pgvector aktiviert, aber kein Plan: Welche Entities vektorisiert? Chunking-Strategie für tabellarische Fitness-Daten? Embedding-Modell (lokal/Cloud)? Migrations-Strategie bei Modellwechsel? Score-Threshold? Beeinflusst DB-Schema und Logging-Felder. |
| H21 | Senior Developer | **Auth-Guard-Coverage-Test** | Meta-Test fehlt: Alle registrierten Routen müssen entweder einen Auth-Middleware-Decorator haben oder in einer expliziten Public-Allowlist stehen. Vergessene Guards werden nie durch Line-Coverage-Tests gefunden. |
| H22 | Senior Developer | **Backup-Monitoring + Docker Log Rotation** | Stille Backup-Fehler seit Tag 3 werden erst bei Datenverlust bemerkt. Docker-Log-Rotation (`max-size: 50m, max-file: 5`) fehlt im `docker-compose.yml` — Pi 5 läuft ohne das über Zeit voll. |

---

### 🟡 Medium Priority — Innerhalb der ersten Sprint-Zyklen

| # | Persona | Thema | Kurzfassung |
| --- | --- | --- | --- |
| M1 | Software Architect | **Sunset-Policy in ADR 005** | Wann wird `/v1/` abgeschaltet? Stale-SW-Clients auf `/v1/` gegen einen Server der nur `/v2/` kennt. `Sunset`-Header (RFC 8594) + Deprecation-Regel jetzt definieren. |
| M2 | Software Architect | **PrismaClient-Instanzierung** | Singleton oder per-Request? Falsche Instanzierung führt auf Pi mit 256MB zu Connection Exhaustion. In Bun-Kontext explizit dokumentieren. |
| M3 | Backend Architect | **Soft-Delete Partial-Index für alle Tabellen** | Partial-Index `WHERE deleted_at IS NULL` ist nur für `exercises` dokumentiert. Prisma-Extension filtert für alle Tabellen — alle brauchen diesen Index. Sequential Scans ohne ihn. |
| M4 | Backend Architect | **argon2-Parameter explizit festlegen** | Library-Defaults variieren. `memoryCost: 65536` (64MB) konfligiert direkt mit 50MB-RAM-Ziel. Einmal auf Pi 5 messen — das muss aufgelöst sein. |
| M5 | Frontend Developer | **Bundle-Visualizer in Toolchain** | `rollup-plugin-visualizer` als devDependency. Ohne Sichtbarkeit in Chunk-Komposition wird das Budget erst beim CI-Fehler bemerkt, nicht beim Entwickeln. |
| M6 | Frontend Developer | **Error-Boundary für Offline-Edge-Cases** | `+error.svelte` pro Route-Segment. "IndexedDB leer + kein Netz + Nutzer öffnet App" → kein definiertes Fallback-UI. Besonders kritisch für aktives Training. |
| M7 | Mobile App Builder | **SW-Cache-Strategie schärfen** | `networkTimeoutSeconds` für NetworkFirst (Empfehlung: 3s) fehlt. SW-Cache vs. IndexedDB für Workout-Caching: zwei parallele Caches ohne Koordinationsprotokoll sind ein Konsistenz-Risiko. |
| M8 | Mobile App Builder | **iOS 14.0–14.3 adressieren** | SW-Bugs in 14.0–14.3 sind gravierend. User-Agent-Check + "Browser-Update empfohlen"-Banner für <14.4. Architektur sagt "bekannt", aber nicht "wie damit umgegangen wird". |
| M9 | UI Designer | **Spacing-Token-Set** | "4px-Grid" ist Design-Regel, kein Token. `--space-1` bis `--space-16` fehlen. Ohne Token schreiben Entwickler `padding: 16px` statt `padding: var(--space-4)`. |
| M10 | UI Designer | **Radius-Token aufteilen** | "8–12px" ist Range, keine Entscheidung. `--radius-sm: 4px` (Badges) / `--radius-md: 8px` (Buttons) / `--radius-lg: 12px` (Cards) / `--radius-pill: 9999px` (Tags). |
| M11 | UI Designer | **Shimmer + ChipGroup Selected-State** | Shimmer-Gradient, Dauer, `prefers-reduced-motion`-Fallback fehlen. ChipGroup Selected-State (Amber-Fill?) nicht im Token-System verankert. |
| M12 | AI Engineer | **AI Rate-Limit-Granularität** | Feedback-Regenerierungs-Limit: pro Tag oder pro Mesozyklus? Globales Server-Limit für alle User kombiniert fehlt. Max. 1 Job gleichzeitig: DB-seitig oder Worker-seitig erzwungen? |
| M13 | AI Engineer | **Contract-Tests für Provider + Progressions-Tag-Check** | Jeder Provider braucht Contract-Test gegen `AiProvider`-Interface. Fallback-Precondition: Sind genug Progressions-MODIFIER-Tags vorhanden für 4-Wochen-Progression? Degraded-Mode dokumentieren. |
| M14 | Senior Developer | **RFC 7807 TypeScript-Interface** | Kein gemeinsamer Typ für das Error-Envelope. Verschiedene Error-Handler implementieren RFC 7807 leicht abweichend. `src/shared/errors/problem-details.ts` mit Zod + TypeScript-Interface — Backend + SvelteKit-Fetch-Wrapper importieren denselben Typ. |
| M15 | Senior Developer | **Contributor-Onboarding-Lücken** | Pre-Commit-Hook (B11) plus: `CONTRIBUTING.md` mit Branching-Konvention, Seeder Offline-Fallback (`exercises.fixture.json` für rein lokales Entwickeln), Hinweis auf `.env`-Sicherheit für Contributor. |

---

### 🟢 Low Priority — Nice to Have

| # | Persona | Thema | Kurzfassung |
| --- | --- | --- | --- |
| L1 | Software Architect | **Coverage-Threshold schichtenweise** | 60% global ist schwacher Proxy. Besser: 80% Service-Layer, 60% Router, kein Pflicht-Threshold für Repo (triviale Delegation). |
| L2 | Backend Architect | **Migrations-Rollback RTO messen** | `pg_dump` auf Pi 5 einmal durchführen und Zeit protokollieren. Falls RTO > 10 Min → WAL-Archivierung prüfen. |
| L3 | Mobile App Builder | **Audio-Session-Kategorie + Swipe-Gesten** | `touch-action: none` + `overscroll-behavior: none` für Swipe-Gesten auf iOS. "Unterbricht keine Musik" ist Annahme — AudioContext mit ambient-Typ prüfen. |
| L4 | UI Designer | **Transition-Easing-Token + OfflineIndicator Z-Index** | `--transition-easing-default` fehlt. OfflineIndicator-Position ("Ecke") konfligiert mit iOS-Home-Indicator — Z-Index-Hierarchie (`--z-index-overlay/toast/modal`) definieren. |
| L5 | AI Engineer | **`prompt_version_id` in ai_jobs + `unknown`-Logging** | Job sollte `prompt_version_id` bei Erstellung einfrieren — Prompt-Rollback zwischen Queue und Verarbeitung sonst nicht nachvollziehbar. `unknown`-Fehler immer mit Stack-Trace loggen. |
| L6 | Senior Developer | **Mutation-Testing + Bundle-Size-Trend** | `stryker-mutator` für Regel-Fallback-Engine (Line-Coverage findet keine falschen Negationen). Bundle-Size als CI-Artifact historisieren — Trend statt Snapshot. |

---

## Review nach Persona

### Software Architect

**Stärken:** Router→Service→Repository mit `eslint-plugin-boundaries` ist architektonisch vorbildlich — Grenzen die Build-Zeit geprüft werden, werden nicht gebrochen. 9 ADRs vor der ersten Codezeile ist eine ungewöhnlich reife Entscheidungskultur. Expand-Contract-Pattern zeigt Bewusstsein für das Schema-Code-Gap. Defense-in-Depth mit drei unabhängigen Schranken (Middleware + Constraint + ESLint) ist robust.

**Lücken & Risiken:**

- **Transaktionsgrenzen ungeklärt.** Wenn `WorkoutSessionService` mehrere Repos aufruft (ExerciseLog, Set, ai_jobs), braucht es `prisma.$transaction()` — aber wer besitzt die Transaktion? Kein Muster definiert. Direkte Konsequenz: `WorkoutSession abschließen + ai_job eintragen` kann inkonsistent enden.
- **Modul-Dependency-Graph fehlt.** `eslint-plugin-boundaries` ist nur für Schichten konfiguriert. Darf `WorkoutModule` `ExerciseModule` direkt importieren? Zirkuläre Abhängigkeiten zwischen Business-Modulen entstehen schleichend.
- **Dead-Letter ohne Recovery-Pfad.** `dead`-Status existiert, aber nichts passiert damit. Akkumulation von dead-Jobs ist ein stilles Observability-Problem.
- **Bounded-Context-Definition fehlt.** Aggregat-Sprache ohne Aggregate-Roots führt zu inkonsistenten Update-Patterns im Service-Layer.
- **API-Versionierungs-Lücke.** `/api/v1/` ist definiert, aber nicht wie Stale-SW-Clients auf `/v1/` mit einem Server umgehen, der nur `/v2/` kennt.

**Offene Fragen:**

- Welche Module dürfen welche anderen importieren (DAG)?
- Ist `WorkoutSession` oder `Mesocyclus` die Aggregate-Root?
- Wer trägt Transaktions-Ownership bei Multi-Repo-Operationen?

---

### Backend Architect

**Stärken:** Serverseitige Session-Tabelle für sofortige Invalidierung ist die richtige Entscheidung für das Workout-Use-Case. AI-Queue mit atomarem Locking (`UPDATE ... WHERE status='pending' RETURNING *`) und Heartbeat-Recovery ist production-grade. RFC 7807 konsequent durchzuhalten verhindert Frontend-seitige Error-Handler-Proliferation.

**Lücken & Risiken:**

- **Prisma Middleware + $transaction = Sicherheitslücke.** Bei interaktiven Transactions greift die Auth-Middleware u.U. nicht. Das ist der kritischste Einzelpunkt: ein User kann stumm Daten anderer User lesen.
- **Session-Tabelle ohne Indizes und Cleanup.** Jeder Auth-Request scannt ohne `@@index([userId, expiresAt])`. Akkumulierte Sessions verlangsamen jeden Request-Auth-Check.
- **CSRF-Schutz unvollständig.** `SameSite=Strict` schützt nicht bei Top-Level-Navigation. Ältere WebViews in PWA-Kontexten implementieren `SameSite` nicht vollständig. Double-Submit-Cookie fehlt.
- **Rate-Limiting ohne Sliding-Window.** Fixed-Window erlaubt 200 Req in 1 Sekunde an Fenstergrenzen. Schema der Rate-Limit-Tabelle fehlt vollständig.
- **OIDC-Rollen-Synchronisation.** Admin-Entzug in Authentik → User bleibt bis zu 60 Min voll privilegiert. `max_age` in Session-Tabelle fehlt. Backchannel-Logout-Endpoint fehlt.
- **argon2-Konflikt mit RAM-Ziel.** `memoryCost: 65536` (64MB empfohlen) konfligiert mit 50MB-RAM-Ziel. Einmal messen.

**Offene Fragen:**

- Wie wird die Prisma-Middleware für Transaction-Clients (`tx`) sichergestellt?
- Sliding-Window via Token-Bucket oder Zeitreihen-Aggregation?
- Wo läuft der Session-Cleanup (Background-Intervall in Bun vs. pg_cron)?

---

### Frontend Developer

**Stärken:** $state-Klassen als Runes-Container (WorkoutSession, TimerState, AudioSettings) mit `load()` für Server-Daten ist idiomatisch korrekt. Timer mit `Date.now()`-Delta zeigt praktische iOS-PWA-Erfahrung. Queue-first Offline-Sync mit UUID-Idempotenz ist solide. Performance-Budget mit CI-Gates und budgetbewusste Library-Wahl (Dexie 20KB, layerchart 15KB).

**Lücken & Risiken:**

- **SvelteKit-Modus nicht festgelegt.** SSR mit personalisierten Workout-Daten und Offline-First-Anforderung ist ein Widerspruch. `adapter-static` + SPA-Mode ist wahrscheinlich richtig — aber das ist eine Architekturentscheidung.
- **Dexie.js Schema-Versionierung fehlt komplett.** IndexedDB-Migrationen sind irreversibel. Ohne Upgrade-Funktion und Fehlerbehandlung bei `onversionchange` droht unbootable State nach App-Update.
- **$state-Klassen-Scope ungeklärt.** Singleton im Module-Scope ist bei SSR gefährlich (Server-Side zwischen Requests geteilt). `setContext/getContext` ist die korrekte Svelte-Lösung.
- **SW-Update-Synchronisation fehlt.** Wer hält den `waiting` SW während des Trainings? `postMessage` oder IndexedDB-Flag? Nicht definiert → ad-hoc implementiert → schwer zu testen.
- **Keine Error-Boundary für Offline-Edge-Cases.** "IndexedDB leer + kein Netz + Nutzer öffnet App" → kein definiertes Fallback-UI pro Route.

**Offene Fragen:**

- `adapter-static` mit `ssr = false` pro Workout-Route, oder vollständiges SPA?
- Workout-Flow: Multi-Route (`/workout/exercise/[id]`) oder Single-Route-State-Machine (`/workout`)?
- Wie verhält sich Browser-Back-Button während Workout-Flow?

---

### Mobile App Builder

**Stärken:** iOS Feature-Matrix ist präzise und ehrlich — differenziert korrekt zwischen 14/15/16/16.4+. `Date.now()`-Delta für Timer ist exakt die richtige Lösung für iOS-Scheduling. Audio-Context-Unlock am Training-Start-Tap ist pragmatisch und technisch korrekt. Device-Service-Abstraktionsschicht macht Capacitor-Swap in Phase 3 ohne Refactoring im Workout-Code möglich. SW-Update-Verzögerung während Training schützt Audio-Context und Timer.

**Lücken & Risiken:**

- **TTS auf iOS ist instabil ohne Absicherung.** Stuck utterance, Abbruch bei Hintergrundwechsel, verzögertes `getVoices()` — alles bekannte Bugs, keiner ist adressiert. Ohne `cancel()` vor `speak()` und `voiceschanged`-Handler ist Hands-Free auf iOS unzuverlässig.
- **PWA-Install-Banner erscheint zu spät und am falschen Ort gespeichert.** Nach erstem Training ist spät — ohne Installation fehlen Wake Lock, besseres Audio-Verhalten, kein Safari-UI. `localStorage` für "einmalig" falsch — IndexedDB `sync_meta` passt besser.
- **Wake-Lock-Fallback für iOS <16.4 ist kein Fallback.** "Display anlassen" ist Nutzeraufforderung. 1x1px-Video-Workaround prüfen oder explizit als "nicht möglich" dokumentieren.
- **IndexedDB-Recovery nach iOS-15.4-Bug fehlt.** Sentinel-Check ohne Recovery-Pfad ist Dokumentation ohne Implementierungsanker.
- **SW-Cache und IndexedDB parallel für Workout ohne Koordination.** Zwei Caches → Inkonsistenz-Risiko. `networkTimeoutSeconds` fehlt für NetworkFirst.

**Offene Fragen:**

- 1x1px-Video-Workaround oder "kein Software-Fallback" für Wake Lock?
- Swipe-Gesten: `touch-action: none` + `overscroll-behavior: none` explizit in CSS-Strategie?
- iOS-Mindestversion: 14.0 oder 14.4+?

---

### UI Designer

**Stärken:** Semantische Token-Benennung (`--color-surface-base` statt `--color-slate-900`) ist konsequent und ermöglicht Light-Mode-Pivot via Theme-Swap ohne Component-Änderungen. `--touch-target-min: 44px` und `prefers-reduced-motion` als Token (nicht als JS-Override) ist korrekt. 3-stufiges Elevation-System via Surface-Farben (nicht Schatten) im Dark-Mode entspricht etabliertem Material-Dark-Pattern.

**Lücken & Risiken:**

- **Amber-Akzent ohne konkreten Wert.** `#f59e0b` auf `#1a1a2e` = ~3.8:1 — WCAG-Fail. `--color-accent` fehlt im Token-Inventar. Interaktive Ebene nicht spezifiziert.
- **Typography-Skala ist Struktur ohne Werte.** "4 Größen" ohne `rem`-Werte, `line-height`, `font-weight`. Timer hat `clamp()`, Body nicht — inkonsistente Behandlung.
- **Fokus-Ring undefiniert.** `--color-focus-ring` fehlt. `--shadow-sm` für Fokus reicht nicht auf allen 3 Surface-Ebenen. WCAG 2.4.11 (Focus Appearance) nicht nachweisbar.
- **State-Layer-Token fehlen.** Hover, Pressed, Disabled: kein Token. Jeder Entwickler erfindet eigene Lösung. Empfehlung: White-Overlay-Modell (`rgba(255,255,255,0.08)` Hover, `0.12` Pressed).
- **Grün-Flash ohne Spec.** Dauer, Scope, Easing, `prefers-reduced-motion`-Fallback: alle unspezifiziert. Zentrale Interaktion ohne Motion-Design.
- **Spacing-System und Radius-Range.** "4px-Grid" und "8–12px" sind Absichtserklärungen — keine Token. Entwickler erfinden eigene Werte.

**Offene Fragen:**

- Konkrete Amber-Shade (Kontrastverhältnis ≥ 4.5:1 gegen alle 3 Surface-Ebenen nachweisen)?
- Grün-Flash: Timer-Display oder ganzer Screen?
- `--transition-easing-default`: `ease-out` (Exit) oder `ease-in-out` (State-Change)?

---

### AI Engineer

**Stärken:** `AiProviderResult`-Union-Type mit typisiertem Fehlervertrag zwingt zu bewusster Fehlerbehandlung — kein stummes Catch-All. Pre-Filter (`availableExerciseIds`) ist strukturelle Sicherheitseigenschaft, keine Laufzeit-Validierung. Prompt-Versionierung mit `is_active`-Flag ermöglicht Rollback ohne Deployment. `ai_generation_logs` mit `balance_score`, `prompt_version_id`, `validation_passed` ermöglicht datengetriebene Prompt-Regression-Erkennung.

**Lücken & Risiken:**

- **JSON-Enforcement für schwache Modelle fehlt.** Ollama 3B auf Pi 5 liefert kein zuverlässiges JSON. Kein Ajv-Validator zwischen LLM-Response und semantischer Validierung. Partieller JSON / Markdown-umwickelter JSON → `invalid_output`-Pfad nicht definiert.
- **Injection-Schutz zu schwach.** Lexikalisches Pattern-Match (`###`, `system:`) ist umgehbar. Kein Zeichenlimit auf Freitext-Inputs. Kein Admin-Alert bei erkanntem Versuch — nur Logging.
- **Regel-Fallback ohne Validierungs-Parität.** Output-Validierungsschritte 1–4 sind für KI-Output definiert — gelten sie auch für Fallback? Ohne gemeinsame `validatePlan()`-Funktion produziert der Fallback möglicherweise invalide Pläne.
- **RAG ist Platzhalter.** pgvector aktiviert, aber kein Plan für Entities, Chunking-Strategie für tabellarische Fitness-Daten, Embedding-Modell, Migrations-Strategie bei Modellwechsel, Score-Threshold. Beeinflusst DB-Schema direkt.
- **Globales Server-Limit fehlt.** Max. 1 Job gleichzeitig ist User-seitig. Admin kann alle Limits deaktivieren → Ollama-NAS unbegrenzt überlastet.
- **Feedback-Regen-Limit nicht granular.** Pro Tag? Pro Mesozyklus? Nicht spezifiziert.

**Offene Fragen:**

- Ollama-API mit `format: "json"` + Ajv-Validator oder nur Prompt-basiertes JSON-Schema?
- Welche Daten werden für Phase-2-RAG vektorisiert?
- Globales Server-Limit: Max. Jobs/Tag systemweit (unabhängig von User-Limits)?

---

### Senior Developer

**Stärken:** CI-Pipeline mit Fail-Fast-Ordnung (statische Analyse → Migration → Tests → Build) ist strukturell korrekt. `prisma migrate diff --exit-code` als Schema-Drift-Guard ist echter Sicherheitsanker. Vollständige .env-Liste mit semantisch klaren Namen verhindert Raten-Müssen. Mehrschichtiges Code-Quality-Enforcement (Biome + ESLint + Allowlist-Test + Modul-Grenzen) ist selten gut umgesetzt. Health-Endpoint mit AI-Worker-Status und Queue-Tiefe gibt operative Sichtbarkeit.

**Lücken & Risiken:**

- **60% Coverage ist statistisch schwacher Proxy.** Kein Branch-Coverage-Ziel, kein Meta-Test für Auth-Guards. Vergessene Guards auf neuen Routen werden nicht automatisch gefunden.
- **Runtime-Env-Validierung fehlt.** 30+ Variablen ohne Laufzeit-Schema-Validierung. Fehlende Variablen schlagen erst beim ersten Use fehl — nicht beim Start.
- **Secrets-Management nicht adressiert.** `JWT_SECRET`, `OIDC_CLIENT_SECRET` im `.env` ohne Secret-Scanning in CI. Für Open-Source mit Contributor-Onboarding ist das ein reales Risiko.
- **Pre-Commit-Hook nicht in `setup.sh` verankert.** Biome-Fehler erst in CI → Minuten-Feedback-Loop statt Sekunden.
- **Monitoring-Gap.** Docker-Logs ohne Retention-Konzept. Backup-Fehler werden nicht bemerkt bis Datenverlust. Kein Alerting bei 5xx-Rate oder AI-Queue-Stau.
- **RFC 7807-Format nicht end-to-end typisiert.** Verschiedene Error-Handler implementieren leicht abweichend — kein gemeinsames Zod-Schema als Anker.

**Offene Fragen:**

- Uptime Kuma auf NAS als Self-Hosted-Monitor (passt zur Infrastruktur)?
- Trunk-based Development oder Feature-Branches (1-Personen-Projekt)?
- Seeder Offline-Fallback: `exercises.fixture.json` für CI und lokales Entwickeln?

---

## Konsolidierte Offene Fragen

### Architektur

1. SvelteKit `adapter-static` (SPA-Mode mit `ssr = false`) oder SSR — explizit festlegen.
2. Welche Module dürfen welche anderen importieren? (DAG für `eslint-plugin-boundaries`)
3. Transaktions-Ownership: Repository-Methoden mit optionalem `tx`-Parameter, Service besitzt `prisma.$transaction()`?
4. Ist `WorkoutSession` oder `Mesocyclus` die Aggregate-Root?

### iOS & Mobile

1. Workout-Flow: Multi-Route oder Single-Route-State-Machine?
2. Wake-Lock-Fallback für iOS <16.4: Video-Workaround oder explizit "nicht möglich"?
3. iOS-Mindestversion: 14.0 oder 14.4+?
4. TTS: `de-DE`-Fallback wenn keine deutsche Stimme → `en-US` oder Ton-Only?

### AI & Safety

1. Ollama-API-Call: `format: "json"` + Ajv-Validator oder nur Prompt-basiertes Schema?
2. Phase-2-RAG: Welche Entities? Lokales oder Cloud-Embedding-Modell?
3. Globales Server-Limit für AI-Jobs (systemweit, nicht nur per User)?
4. Feedback-Regen-Limit: pro Tag oder pro Mesozyklus?

### Design & UI

1. Konkrete Amber-Shade mit WCAG-AA-Nachweis gegen alle 3 Surface-Ebenen.
2. Grün-Flash: Timer-Display oder ganzer Screen? Dauer?
3. State-Layer-Modell: White-Overlay oder statische Token?

### Operations

1. Session-Cleanup: Background-Intervall in Bun oder pg_cron?
2. argon2-`memoryCost: 65536` vs. 50MB-RAM-Ziel — einmal messen, dann entscheiden.
3. RTO für Migrations-Rollback: `pg_dump` auf Pi 5 einmal durchführen und protokollieren.

---

## Entscheidungs-Log (Runde 2)

Alle 44 Findings wurden mit Thomas besprochen. Entscheidungen in ARCHITECTURE.md eingearbeitet.

| # | Thema | Entscheidung | In ARCHITECTURE.md |
| --- | --- | --- | --- |
| B1 | Transaktionsgrenzen | Optionaler `tx?: PrismaTransaction`-Parameter. Service besitzt `$transaction()`. ADR 010 erstellt. | ✅ |
| B2 | Modul-Dependency-Graph | Vollständiger 8-Modul-DAG: shared ← auth ← user ← exercise/ai ← mesocyclus ← workout; body-metrics ← user; admin → alle | ✅ |
| B3 | Prisma $transaction Lücke | Explizite `userId`-Injektion in allen Repo-Methoden. ESLint-Regel blockiert $transaction ohne userId. Integration-Test je Tabelle. | ✅ |
| B4 | SvelteKit-Modus | SPA-Mode: `adapter-static`, `ssr = false` global | ✅ |
| B5 | Dexie Schema-Versionierung | Schema ab Version 1. Upgrade-Funktion pro Version. iOS-15.4-Sentinel-Check. | ✅ |
| B6 | TTS-Resilienz iOS | `cancel()` vor jedem `speak()`. `voiceschanged`-Handler. Fallback: `en-US` oder Ton-Only. | ✅ |
| B7 | Amber-Akzentfarbe | `#fcd34d` (amber-300). `--color-accent-text: #1a1a2e`. Kontrast 7.4–8.1:1 WCAG AA. | ✅ |
| B8 | JSON-Output-Enforcement | Ollama `format: "json"` + Ajv-Validator vor semantischer Validierung. Parse-Fehler → `invalid_output`. | ✅ |
| B9 | Injection-Limit + Alert | 1.000-Zeichen-Hard-Limit. Erkannter Versuch → Generation abbrechen + Admin-Alert. `injection_detected` in Logs. | ✅ |
| B10 | Runtime-Env-Validierung | Zod-Schema in `src/config.ts`. Fail-Fast beim Start. S3_* bedingt required. | ✅ |
| B11 | Secret-Scanning + Hooks | gitleaks als erster CI-Step. Pre-Commit-Hook (biome + tsc) in `setup.sh` installiert. | ✅ |
| H1 | Cross-Cutting-Concerns | In `shared/middleware/` verorten. Reihenfolge: Auth → Rate-Limit → Logging → Route-Handler. | ✅ |
| H2 | Dead-Letter-Recovery | Regel-Fallback auto-aktiviert. User Toast. `bun run cli retry-dead-jobs`. 30-Tage-Cleanup. /debug sichtbar. | ✅ |
| H3 | Aggregate-Roots | `WorkoutSession` ist Aggregate-Root. Cross-Aggregate-Zugriff nur via Service-Layer. | — |
| H4 | OIDC Backchannel-Logout | `/api/v1/auth/backchannel-logout`-Endpoint. Authentik-initiated Session-Termination. | ✅ |
| H5 | Session-Tabelle Indizes | `@@index([userId, expiresAt])`, `@@index([expiresAt])`. Cleanup-Job alle 15 Min. | ✅ |
| H6 | Sliding-Window Rate-Limit | Token-Bucket. Response-Headers: `X-RateLimit-Limit/Remaining`, `Retry-After` bei 429. | ✅ |
| H7 | Session max_age | 8h User / 1h Admin. Unabhängig vom letzten Request. | ✅ |
| H8 | CSRF Double-Submit | SameSite=Strict + Double-Submit-Cookie (X-CSRF-Token Header) + Origin-Header-Prüfung. | ✅ |
| H9 | SW-Kommunikation Training | `postMessage({type: 'WORKOUT_ACTIVE'})` / `WORKOUT_COMPLETE`. SW hält `skipWaiting()` zurück. | ✅ |
| H10 | $state-Klassen Scope | `setContext/getContext` im `+layout.svelte`. Kein Module-Scope-Singleton. | ✅ |
| H11 | Komponenten-Hierarchie | PauseScreen = Modal-Overlay. WorkoutSummary = eigene Route. | — |
| H12 | PWA Install Timing | Nach erstem abgeschlossenem Training. `navigator.standalone`-Check. Status in `sync_meta`. | ✅ |
| H13 | Wake-Lock-Fallback | Kein Video-Workaround. Explizit: "nicht möglich" für iOS <16.4 — UI-Hinweis. | ✅ |
| H14 | IndexedDB iOS-Recovery | Sentinel-Check → Toast + Server-Resync-Trigger. `current_workout` invalidiert. | ✅ |
| H15 | Typography-Token | Vollständige Skala: `--text-sm/base/lg/xl` mit `rem` + `line-height`. | ✅ |
| H16 | Fokus-Ring | `--color-focus-ring: #fcd34d`. `outline-offset: 3px`. Auf allen 3 Surface-Ebenen. | ✅ |
| H17 | State-Layer | Hover: `rgba(255,255,255,0.08)`. Pressed: `rgba(255,255,255,0.12)`. | ✅ |
| H18 | Grün-Flash | Ganzer Screen (Option B). `--color-success`. 600ms ease-out. `prefers-reduced-motion`: statisch. | ✅ |
| H19 | validatePlan() geteilt | Gemeinsame Funktion für KI-Output und Regel-Fallback. Kein Fallback-Plan kann Validierung umgehen. | ✅ |
| H20 | RAG Phase 2 | Details auf Phase 2 verschoben. pgvector aktiviert. Keine DB-Schema-Änderung jetzt nötig. | — |
| H21 | Auth-Guard Meta-Test | Alle Routen: Guard-Decorator oder explizite Public-Allowlist. Test schlägt bei fehlender Zuordnung fehl. | ✅ |
| H22 | Backup-Monitoring | Docker Log-Rotation in compose. Backup-Failure-Alerting via Health-Endpoint. | — |
| M1 | Sunset-Header | `Sunset`-Header (RFC 8594) in API-Design-Sektion. | ✅ |
| M2 | PrismaClient-Singleton | Singleton dokumentiert. Per-Request würde 256MB-Limit auf Pi überschreiten. | — |
| M3 | Soft-Delete Partial-Index | Gilt für alle Tabellen (nicht nur exercises). In DB-Indizes-Sektion erwähnt. | — |
| M4 | argon2-Parameter | `memoryCost: 19456` (19MB, Pi-freundlich), `timeCost: 3`, `parallelism: 4`. | ✅ |
| M5 | Bundle-Visualizer | `rollup-plugin-visualizer` als devDependency. (Implementierungsdetail) | — |
| M6 | Error-Boundary | `+error.svelte` pro Route-Segment. (Implementierungsdetail) | — |
| M7 | SW networkTimeoutSeconds | `networkTimeoutSeconds: 3` für NetworkFirst. | ✅ |
| M8 | iOS 14.0–14.3 Banner | User-Agent-Check → "Browser-Update empfohlen"-Banner. | ✅ |
| M9 | Spacing-Token | `--space-1: 4px` bis `--space-16: 64px` (10 Stufen, 4px-Grid). | ✅ |
| M10 | Radius-Token | sm: 4px / md: 8px / lg: 12px / pill: 9999px. | ✅ |
| M11 | Shimmer + ChipGroup | Shimmer: 90deg gradient, 1.5s, ease-in-out. ChipGroup: accent background + accent-text. | ✅ |
| M12 | Feedback-Regen-Limit | 1 pro Tag (Reset täglich). Globales Limit: 20 Jobs/Tag systemweit. | ✅ |
| M13 | Contract-Tests | (Implementierungsdetail — bei Provider-Integration adressieren) | — |
| M14 | RFC 7807 TypeScript-Typ | `src/shared/errors/problem-details.ts` mit Zod + TypeScript-Interface. | ✅ |
| M15 | Contributor-Onboarding | Pre-commit in setup.sh (B11). `exercises.fixture.json` für Offline-Dev. | ✅ |
| L1 | Coverage-Threshold | 80% Service-Layer, 60% Router. Kein Pflicht-Threshold für triviale Repos. | ✅ |
| L2 | Migrations-RTO | (Operativ — bei erstem Deployment messen) | — |
| L3 | Touch-Action iOS | `touch-action: none` + `overscroll-behavior: none`. (Implementierungsdetail) | — |
| L4 | Transition + Z-Index | `--transition-easing: ease-out`. Z-Index-Hierarchie: overlay 100 / toast 200 / modal 300. | ✅ |
| L5 | prompt_version_id | Bei Job-Start eingefroren. In ai_generation_logs + ai_jobs. | ✅ |
| L6 | Mutation-Testing | (Deferred — nach erstem Testlauf entscheiden) | — |
