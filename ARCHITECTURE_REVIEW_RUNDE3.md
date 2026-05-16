# Hone — Architektur-Review (Runde 3)

**Datum:** 2026-05-16
**Basis:** ARCHITECTURE.md nach Runde-2-Überarbeitung
**Reviewer-Personas:** Software Architect · Backend Architect · Mobile App Builder · Frontend Developer · Senior Developer · UI Designer · AI Engineer

---

## 1. Executive Summary

Die Runde-2-Überarbeitung hat die Architektur erheblich gestärkt: 30 von 38 verifizierten R2-Items sind vollständig gelöst, 6 teilweise gelöst, und nur 2 verbleiben offen. Das Fundament — Transaktionsgrenzen (ADR 010), Modul-DAG, Session-Sicherheit, AI-Queue-Design, iOS-Feature-Matrix — ist produktionsreif spezifiziert.

Runde-3-Findings sind qualitativ verschieden von Runde 1 und 2: Weniger fehlende Konzepte, mehr **fehlende Verträge innerhalb bestehender Konzepte** (Ajv-Schema-Inhalt, SW-postMessage-Mechanismus, GeneratePlanOutput-Struktur, Fokusring-Kontrastverhältnis pro Surface). Die 8 neu identifizierten Blocker betreffen ausnahmslos Implementierungsdetails, die ohne Entscheidung zu Day-1-Brüchen führen: ein fehlender `prisma generate`-Schritt in CI macht jede saubere Checkout-Pipeline sofort kaputt; ein architektonisch falsch verdrahtetes SW-postMessage blockiert das Update-Protokoll still; eine undefinierte `GeneratePlanOutput`-Struktur lässt Ajv gegen kein Schema validieren.

Das Projekt ist **nicht bereit für den ersten Commit** ohne Auflösung der 8 Blocker und der 3 kritischen Cross-Persona-Befunde. Mit diesen Korrekturen — alle lösbar durch ARCHITECTURE.md-Ergänzungen, kein Architektur-Umbau erforderlich — ist die Basis für eine stabile Implementierung vorhanden.

---

## 2. Runde-2 Verification Summary

Vollständige Verifikationsmatrix aller R2-Items über alle 7 Personas.

| R2-ID | Thema | Status R3 | Persona | Anmerkungen |
|-------|-------|-----------|---------|-------------|
| B1 | Transaktionsgrenzen-Strategie (ADR 010) | ✅ | Software Architect | ADR 010 mit tx-pattern Code-Snippet an 3 Stellen präsent |
| B2 | Modul-DAG — 8-Modul-gerichteter Graph | ✅ | Software Architect | Alle 8 Module mit Import-Richtungen + eslint-plugin-boundaries |
| B3 | Prisma Middleware in $transaction | ✅ | Software Architect / Backend Architect | userId-Injection + ESLint-Regel + Integrationstests |
| B4 | SvelteKit SPA-Mode (adapter-static, ssr=false) | ✅ | Frontend Developer | Explizit in Zeile 327 + 864 |
| B5 | Dexie.js Schema-Versionierung V1 mit Upgrade-Funktionen | ✅ | Frontend Developer | Beide Anforderungen formuliert |
| B6 | TTS-Resilienz auf iOS | ✅ | Mobile App Builder | cancel() vor speak(), voiceschanged, en-US-Fallback — alle 3 vorhanden |
| B7 | Amber-Kontrast WCAG AA | ✅ | UI Designer | #fcd34d, 7.4–8.1:1 dokumentiert |
| B8 | JSON-Output-Enforcement (Ollama format:json + Ajv) | ✅ | AI Engineer | Alle 4 Elemente vorhanden: format:json, Ajv vor semantischer Validierung, invalid_output-Pfad, 3B-Retry |
| B9 | Injection-Schutz (1000-Zeichen + abort + Admin-Alert) | ✅ | AI Engineer | Alle 3 Elemente vorhanden |
| B10 | Runtime-Env-Validierung (Zod, fail-fast) | ✅ | Senior Developer | src/config.ts + Zod-Schema + bedingte Anforderungen |
| B11 | Secret-Scanning (gitleaks first) + Pre-Commit | ✅ | Senior Developer | Beide vorhanden |
| H1 | Cross-Cutting-Concerns (shared/middleware/) | ✅ | Software Architect | Ort bestätigt; Middleware-Reihenfolge NICHT in ARCHITECTURE.md (neue Lücke) |
| H2 | Dead-Letter-Recovery-Pfad | ✅ | Software Architect | Alle 5 erforderlichen Elemente vorhanden |
| H3 | WorkoutSession als Aggregate-Root | ⚠️ | Software Architect | In R2 entschieden, als "—" markiert, NICHT in ARCHITECTURE.md |
| H4 | OIDC Backchannel-Logout-Endpoint | ✅ | Backend Architect | /api/v1/auth/backchannel-logout vorhanden |
| H5 | Session-Tabelle: Indizes + Cleanup-Job | ✅ | Backend Architect | @@index([userId, expiresAt]) + Cleanup alle 15 Min |
| H6 | Sliding-Window-Rate-Limiting + Response-Header | ⚠️ | Backend Architect | Algorithmus + Header vorhanden; Rate-Limit-Tabellenschema fehlt |
| H7 | Session max_age (8h User / 1h Admin) | ✅ | Backend Architect | An zwei Stellen vorhanden |
| H8 | CSRF Double-Submit-Cookie | ✅ | Backend Architect | SameSite=Strict + Double-Submit + Origin-Check |
| H9 | SW postMessage (WORKOUT_ACTIVE/COMPLETE) | ✅ | Frontend Developer | Vollständiger Code-Block vorhanden (mechanisch fehlerhaft — neue Lücke) |
| H10 | $state via setContext/getContext (kein Modul-Singleton) | ✅ | Frontend Developer | Alle 3 State-Klassen mit korrektem Scope benannt |
| H11 | PauseScreen=Modal, WorkoutSummary=Route | ❌ | Frontend Developer / Mobile App Builder | R2-Log "—". Nirgends in ARCHITECTURE.md. Blockiert SW-Caching-Strategie |
| H12 | PWA-Install-Erkennung + Banner-Timing | ✅ | Mobile App Builder | navigator.standalone + matchMedia beide gelistet, Timing korrekt |
| H13 | Wake-Lock-Fallback-Entscheidung | ✅ | Mobile App Builder | "nicht möglich für iOS <16.4 — UI-Hinweis" explizit |
| H14 | IndexedDB-Recovery (iOS-15.4-Bug) | ✅ | Mobile App Builder | Sentinel-Check → Toast + Resync |
| H15 | Typografie-Token-Vollständigkeit | ✅ | UI Designer | 4 Skalenstufen mit rem + line-height. Font-weight fehlt (neue Lücke) |
| H16 | Fokusring spezifiziert | ✅ | UI Designer | Farbe, Offset, "auf allen 3 Surface-Ebenen". Kontrastverhältnis pro Surface nicht berechnet (neue Lücke) |
| H17 | State-Layer-Tokens | ✅ | UI Designer | Hover/Pressed/Disabled alle definiert |
| H18 | Green Flash spezifiziert | ✅ | UI Designer | Scope + Dauer + Easing + reduced-motion-Fallback |
| H19 | validatePlan() geteilte Funktion | ✅ | AI Engineer | Deckt explizit AI-Output UND Fallback ab |
| H20 | RAG Phase 2 Details | ✅ (zurückgestellt) | AI Engineer | pgvector aktiviert, Details Phase 2 |
| H21 | Auth-Guard-Meta-Test | ⚠️ | Senior Developer | Testabsicht beschrieben, konkrete Form der Allowlist undefiniert |
| H22 | Docker-Log-Rotation + Backup-Monitoring | ❌ | Senior Developer | Explizit als "—" in R2. Nicht in ARCHITECTURE.md |
| M1 | Sunset-Header-Policy (ADR 005) | ✅ | Software Architect | RFC 8594 vorhanden |
| M2 | PrismaClient-Singleton | ❌ | Software Architect | Nicht dokumentiert — Singleton-Entscheidung nie festgeschrieben |
| M3 | Soft-Delete-Partial-Index für ALLE Tabellen | ⚠️ | Backend Architect | Nur exercises-Beispiel gezeigt; kein Statement, dass ALLE Tabellen dies erfordern |
| M4 | argon2-Parameter (memoryCost 19456) | ✅ | Backend Architect | Dokumentiert mit Pi-freundlicher Begründung |
| M5 | Bundle-Visualizer (rollup-plugin-visualizer) | ⚠️ | Frontend Developer | "Stats als Artifact" in CI, aber rollup-plugin-visualizer nie genannt |
| M6 | Error-Boundary (+error.svelte je Route) | ❌ | Frontend Developer | Nirgends in ARCHITECTURE.md erwähnt |
| M7 | SW networkTimeoutSeconds: 3 | ✅ | Mobile App Builder | Network-First+Fallback (3s Timeout) explizit |
| M8 | iOS 14.0–14.3 User-Agent-Banner | ✅ | Mobile App Builder | Banner mit SW-Bug-Begründung gezeigt |
| M9 | Spacing-Tokens | ✅ | UI Designer | --space-1 bis --space-16 (4px-Grid) |
| M10 | Radius-Tokens | ✅ | UI Designer | sm/md/lg/pill mit Werten und Verwendung |
| M11 | Shimmer + ChipGroup-Selected-State | ✅ | UI Designer | Beide vollständig definiert |
| M12 | AI-Rate-Limit-Granularität | ✅ | AI Engineer | Alle 4 Dimensionen dokumentiert |
| M13 | Contract-Tests für AI-Provider | ✅ (zurückgestellt) | AI Engineer | Dokumentierter bewusster Aufschub |
| M14 | RFC 7807 TypeScript-Interface | ✅ | Senior Developer | problem-details.ts in Modulstruktur |
| M15 | Contributor-Onboarding | ✅ | Senior Developer | setup.sh + exercises.fixture.json referenziert |
| L1 | Coverage-Schwellenwerte (80%/60%) | ✅ | Software Architect / Senior Developer | In CI-Pipeline + Testing-Sektion |
| L2 | Migrations-Rollback-RTO | ✅ | Backend Architect | 4-Schritt-Runbook vorhanden |
| L3 | touch-action + overscroll CSS | ⚠️ | Mobile App Builder | Bewusst als Implementierungsdetail zurückgestellt (Entscheidung in R2-Log festgehalten) |
| L4 | Transition-Easing + Z-Index-Hierarchie | ✅ | UI Designer | Beide definiert |
| L5 | prompt_version_id eingefroren bei Job-Erstellung | ⚠️ | AI Engineer | In ai_generation_logs vorhanden; NICHT in ai_jobs-Tabellenschema |
| L6 | Mutation-Testing | ✅ (zurückgestellt) | Senior Developer | Dokumentierter bewusster Aufschub |

**Verifikationsergebnis Runde 2:**
- ✅ Vollständig gelöst: 30
- ⚠️ Teilweise gelöst: 8 (H3, H6, H21, M3, M5, L3, L5)
- ❌ Noch offen: 5 (H11, H22, M2, M6 — plus B2-artige Lücken in neu entdeckten Bereichen)

---

## 3. Neue Findings — Runde 3

Sortiert nach Schweregrad. Jede Zeile trägt eine eindeutige R3-ID für den Entscheidungs-Log.

### 3.1 Blocker — Vor dem ersten Commit

| R3-ID | Persona | Thema | Beschreibung |
|-------|---------|-------|--------------|
| R3-B1 | Senior Developer | **prisma generate fehlt in CI-Pipeline** | CI-Reihenfolge ist gitleaks→biome→tsc. Kein `prisma generate`-Schritt. Saubere CI-Umgebung hat keine Prisma-Client-Types; `tsc` schlägt bei jedem neuen Checkout fehl. Day-1-Bruch der Pipeline. |
| R3-B2 | Mobile App Builder | **SW-postMessage an wartenden SW architektonisch fehlerhaft** | `navigator.serviceWorker.controller?.postMessage()` adressiert den AKTIVEN SW, nicht den WARTENDEN SW (der skipWaiting zurückhält). Der wartende SW empfängt diese Nachricht nicht. Benötigt Neudesign: IndexedDB-Flag oder `registration.waiting.postMessage()`. |
| R3-B3 | Mobile App Builder | **current_workout-Invalidierungsvertrag undefiniert** | Keine Spec: Überlebt Browserneustart? SW-Update während des Trainings? Max-Age? Nur bei WorkoutSummary gelöscht? Veraltete Daten aus unvollständigen Sessions werden still neu geladen. |
| R3-B4 | Frontend Developer | **Workout-URL-Routing nie entschieden** | R2 listete dies als offene Frage, aber kein Entscheidungs-Log-Eintrag existiert. Multi-Route (/workout/exercise/[id]) vs. Single-Route-State-Machine (/workout) ist grundlegend: beeinflusst SW-Caching, Back-Button-Verhalten, H11 und das gesamte State-Management. |
| R3-B5 | Frontend / Mobile (Cross-Persona) | **H11 (PauseScreen=Modal, WorkoutSummary=Route) nie geschrieben** | Durch Frontend Developer (❌) und Mobile App Builder (🟠) als kritisch markiert. PauseScreen/WorkoutSummary-Kompositionshierarchie fehlt völlig. Blockiert SW-URL-Caching-Strategie, Workout-URL-Routing und Back-Button-Verhalten. Eleviert auf Blocker. |
| R3-B6 | AI Engineer | **Ajv-Schema-Inhalt undefiniert** | GeneratePlanOutput-Typ ist referenziert, aber nie spezifiziert. Ajv validiert gegen nichts. Pflichtfelder, Typen, Array-Constraints vollständig absent. Retry-Pfad hat kein Schema. |
| R3-B7 | Backend Architect | **Backchannel-Logout logout_token JWT-Validierung unspezifiziert** | Keine JWKS-Verifikation, keine iss/aud/iat/jti-Claim-Validierung. Jeder Aufrufer kann eine Logout-Anfrage fälschen. Security-Blocker. |
| R3-B8 | Backend Architect | **CSRF-Token-Ausgabepunkt und Client-Side-Management unspezifiziert** | Im SPA-Modus mit adapter-static gibt es keinen Server zur Token-Injektion. Wo wird der Token ausgegeben? Wie holt und sendet die SPA ihn? |

### 3.2 High — Vor der ersten User-Story

| R3-ID | Persona | Thema | Beschreibung |
|-------|---------|-------|--------------|
| R3-H1 | Software Architect | **Middleware-Reihenfolge nicht in ARCHITECTURE.md** | "Auth→Rate-Limit→Logging→Route-Handler" in R2 entschieden, aber nie in ARCHITECTURE.md geschrieben. Falsche Reihenfolge riskiert sicherheitsrelevante Datenlecks in Logs vor Auth. |
| R3-H2 | Software Architect | **WorkoutSession-Aggregate-Root-Vertrag fehlt** | Entwickler, die MesocyclusService schreiben, haben keine Anleitung, ob sie WorkoutSessionRepository direkt aufrufen dürfen. Kein Cross-Aggregate-Access-Vertrag dokumentiert. |
| R3-H3 | Software Architect | **admin-Modul "imports-all" — operative Constraints undefiniert** | Operative Beschränkungen, was admin mit diesen Imports TUN darf, sind undefiniert. Admin wird zum Modul, wo alle Abstraktionsdisziplin kollabiert. |
| R3-H4 | Software Architect | **ADR-010-Code-Snippet inkonsistent mit userId-Mandat** | `async create(data, tx?)` ohne userId-Parameter — inkonsistent mit "alle Repo-Methoden mit expliziter userId-Injektion". |
| R3-H5 | Software Architect | **GDPR-Delete-User: Anonymisierungs-Transaktionspfad unspezifiziert** | Soft-deleted Exercises, die zu global promoted werden: welcher Service, welche Felder, ist es in $transaction? Architektonisch nicht spezifiziert. |
| R3-H6 | Software Architect | **PrismaClient-Singleton-Speicherort nie dokumentiert** | Auf Pi 5 mit 256MB-Limit würden mehrere Instanzen den Connection-Pool erschöpfen. Kanonischer Modul-Pfad (z.B. src/shared/db.ts) fehlt. |
| R3-H7 | Backend Architect | **Rate-Limit-Tabellenschema nie definiert** | DB-basiertes Rate-Limiting erfordert Spaltendefinitionen (user_id-Key, window_start, request_count, Indizes, Cleanup-Mechanismus). |
| R3-H8 | Backend Architect | **argon2 memoryCost 19456 unter OWASP-Minimum** | 19MB liegt unter dem OWASP-Minimum von 64MB. Begründung "Pi-freundlich" vorhanden, aber keine formelle Risikoakzeptanz oder Security-Trade-off-Bewertung dokumentiert. |
| R3-H9 | Backend Architect | **/debug-Screen ohne Access-Control-Spezifikation** | Exponiert User-IDs ohne definierte Zugriffskontrolle. "Versteckt" ist keine Zugriffskontrolle. Muss Admin-only sein, muss in Guard-or-Allowlist erscheinen. |
| R3-H10 | Backend Architect | **Seed-Dateien: Prompt-Injection-Risiko** | Seed-Dateien von Contributors können Prompt-Injection-Payloads in Exercise-Description-Feldern einbetten. Seeder umgeht das 1000-Zeichen-Limit und die Steuer-Token-Erkennung, die für Runtime-Inputs gelten. |
| R3-H11 | Mobile App Builder | **iOS-Mindestversion ambivalent** | ARCHITECTURE.md sagt "iOS 14+", aber 14.0–14.3 haben "gravierende" SW-Bugs. "Zeigt ein Banner" ist keine Versions-Policy. Entscheidung erforderlich: hartes Minimum 14.4+ ODER dokumentierte "Degraded-but-functional"-Akzeptanz. |
| R3-H12 | Mobile App Builder | **Auto-Advance + Hintergrundunterbrechung: Position nicht neu berechnet** | visibilitychange-Handler synchronisiert Timer, aber nicht die Auto-Advance-Position. Bei 3 Minuten Hintergrund während einer 45-Sekunden-Übung ist die Auto-Advance-Position nicht neu berechnet. |
| R3-H13 | Frontend Developer | **ssr=false + load()-Interaktionsgrenze undefiniert** | SvelteKit-SPA-Modus verbietet +page.server.ts, aber Architektur sagt dies nie explizit. Erster Contributor wird +page.server.ts schreiben und einen stillen Build-Überraschungseffekt erleben. |
| R3-H14 | Frontend Developer | **AudioSettingsOverlay Context-Ownership unspezifiziert** | "Timer läuft weiter" erfordert TimerState-Zugriff. Funktioniert nur, wenn im Layout-Tree gerendert (nicht als Portal). Muss explizit angegeben werden. |
| R3-H15 | UI Designer | **Fokusring-Kontrast numerisch nicht verifiziert pro Surface** | WCAG 2.4.11 erfordert 3:1 zwischen Fokusindikator und angrenzendem unfokussiertem Element. Drei Hintergrundwerte (#1a1a2e, #1e2240, #252b4a) × Fokusring #fcd34d — keiner individuell berechnet. Behauptung ist qualitativ ("sichtbar"), nicht quantitativ. |
| R3-H16 | UI Designer | **--color-success, --color-error, --color-warning ohne Hex-Werte** | Token-Namen existieren; Werte nicht. Kein CSS-Token-File kann geschrieben werden. |
| R3-H17 | UI Designer | **Font-Loading-Strategie fehlt** | Geist Mono und Inter: kein self-hosted @font-face, kein CDN-Link, keine font-display-Strategie, kein preload. FOUT am Training-Timer konterkariert das erklärte UX-Ziel "verhindert Layout-Jitter". |
| R3-H18 | AI Engineer | **Simplified Prompt für 3B-Modell-Retry undefiniert** | Kein Inhalt, kein Speicherort (separater ai_prompts-Eintrag?), keine Definition von "simplified". Retry-Pfad hat keinen Inhalt zum Ausführen. |
| R3-H19 | AI Engineer | **Unicode-Normalisierung fehlt** | Injection-Detection-Patterns matchen nur ASCII. Kyrillische/griechische Homoglyphen (е vs e) umgehen die Erkennung vollständig. Kein NFC/NFKC-Normalisierungsschritt vor der Textverarbeitung. |
| R3-H20 | AI Engineer | **Keine Guardrail für constraint-verletzende AI-Empfehlungen** | Pre-Filter sichert Exercise-IDs, aber validatePlan() vier semantische Checks decken keine constraint-aware Volume/Intensity ab. AI kann 4 Sets bodyweight_squat (tagged "Knieschonend") bei hohem Volumen für einen Nutzer mit Knie-Constraints vorschreiben. |
| R3-H21 | Senior Developer | **Auth-Guard-Allowlist ohne definierte Form** | Meta-Test erfordert Enumeration jeder öffentlichen Route, aber Allowlist-Form (TypeScript-const? Runtime-Config? Annotation?) unspezifiziert. Test kann nicht konsistent implementiert werden. |
| R3-H22 | Senior Developer | **exercises.fixture.json Format und Generierungsprozess undokumentiert** | Contributor sieht "für Offline-Dev" ohne Pfad nach vorne. Committed? Durch Script generiert? Welches Schema? |
| R3-H23 | Senior Developer | **Ollama-Fallback-Verhalten in Dev-Umgebung undokumentiert** | Wenn src/config.ts AI_BASE_URL als required definiert, kann Contributor ohne GPU die App nicht starten. Expliziter Dev-Mode nullbarer AI-Config-Pfad erforderlich. |

### 3.3 Medium — Vor dem ersten Release

| R3-ID | Persona | Thema | Beschreibung |
|-------|---------|-------|--------------|
| R3-M1 | Backend Architect | **Content-Security-Policy (CSP)-Header nicht spezifiziert** | Fehlt in der Security-Header-Tabelle. |
| R3-M2 | Backend Architect | **OpenAPI-Spec-Ownership und Update-Prozess undefiniert** | Kein CI-Validierung gegen die laufende Implementierung. |
| R3-M3 | Mobile App Builder | **PWA-Install-Banner Boolean-Logik unspezifiziert** | Soll Banner unterdrückt werden, wenn ENTWEDER navigator.standalone ODER matchMedia true zurückgibt? `isInstalled = standalone || matchMedia` muss angegeben werden. |
| R3-M4 | Mobile App Builder | **Capacitor Phase 3: keine Datei-Level-Import-Boundary** | Kein ESLint no-restricted-globals-Regel verhindert workout-core den direkten Import von Browser-APIs. |
| R3-M5 | Frontend Developer | **Prisma-Typ-Isolierung: Enforcement-Mechanismus fehlt** | "Prisma-Types erreichen niemals das Frontend-Bundle" ist angegeben, aber kein ESLint no-restricted-imports-Regelname genannt. |
| R3-M6 | Frontend Developer | **JS-Bundle-Budget ohne unterstützende Berechnung** | <150KB-Warnung, <250KB-Fail ohne Baseline-Kalkulation. SvelteKit ~40KB + Dexie 20KB + layerchart 15KB = ~75KB Baseline vor App-Code. Eng aber unvalidiert. |
| R3-M7 | UI Designer | **Font-Weight fehlt in Typografie-Skala** | --text-sm bis --text-xl haben rem/line-height aber kein Weight. Browser-Standard (400) flacht visuelle Hierarchie ab. |
| R3-M8 | UI Designer | **ProgressDot 44px-Touch-Target-Mechanismus unspezifiziert** | Spec sagt "rein informativ" (nicht-interaktiv), aber UX impliziert Sprung zur Übung. Entscheidung: interaktiv (44px-Target + role="button") oder informativ (kein Target nötig)? |
| R3-M9 | UI Designer | **OfflineIndicator ohne Position-Token oder Farbschema** | "Dezenter Offline-Status (Icon in Ecke)" — welche Ecke? Offset? Welches Farb-Token? |
| R3-M10 | UI Designer | **Badge-Komponente ohne Farbschema** | Global vs. Privat vs. Tag-Badges brauchen visuelle Differenzierung. Kein Token-Assignment. |
| R3-M11 | UI Designer | **Fehlendes Error/Destructive-Farb-Token** | ConfirmDialog und Toast referenzieren Fehlerzustände ohne spezifizierte Farbanwendung. |
| R3-M12 | UI Designer | **Animations-Specs nur für Green Flash und Shimmer** | Modal öffnen/schließen, Toast enter/exit, AudioSettingsOverlay reveal, ChipGroup selection — alle dem Entwickler überlassen. |
| R3-M13 | AI Engineer | **prompt_version_id in ai_jobs fehlt** | ai_generation_logs hat es, ai_jobs nicht. Wenn bei Job-Erstellung eingefroren, muss die Einfrierquelle ai_jobs sein. Andernfalls kann der Wert vom aktiven Prompt zum Log-Write-Zeitpunkt geschrieben werden. |
| R3-M14 | AI Engineer | **Fallback-Rule-Engine-Output-Shape nicht verifiziert als GeneratePlanOutput-kompatibel** | Prozedurale Spec gibt keine emittierte Datenstruktur an. Wenn sie vom AI-Pfad abweicht, schlägt validatePlan() bei allen Fallback-Plänen fehl. |
| R3-M15 | AI Engineer | **Health-Endpoint-Flag-Semantik bei invalid_key ambivalent** | `aiProviderStatus: "unavailable"` vermischt transienten Ollama-Ausfall mit dauerhaftem ungültigem API-Key. Admin kann nicht unterscheiden. |
| R3-M16 | AI Engineer | **Malformed-JSON-passes-Ajv-Pfad nicht spezifiziert** | JSON-valid + Ajv-valid aber semantisch ungültig: konsumiert dies das gemeinsame 2-Retry-Budget oder einen separaten Zähler? |
| R3-M17 | Senior Developer | **`bun run cli`-Interface nicht formal dokumentiert** | promote-admin, retry-dead-jobs, restore-exercise erscheinen als Einzeiler ohne Dateipfad, Argumente oder Docker-exec-Anweisungen. |
| R3-M18 | Senior Developer | **Umgebungsspezifische Konfigurationsunterschiede (dev/test/prod) nicht dokumentiert** | Kein Test-Datenbank-Setup-Schritt in CI. |
| R3-M19 | Senior Developer | **Test-Fixture-Isolation nicht spezifiziert** | Sind Integrationstests transaktional? Separate DATABASE_URL_TEST? |

### 3.4 Low — Technische Schulden

| R3-ID | Persona | Thema | Beschreibung |
|-------|---------|-------|--------------|
| R3-L1 | Backend Architect | **OpenAPI-Spec-CI-Validierung fehlt** | Kein automatischer Abgleich zwischen Spec und Implementierung in CI. |
| R3-L2 | Frontend Developer | **Svelte-5-$effect in Klassen-Bodies ohne $effect.root()-Cleanup** | Memory-Leak-Risiko in langen Workout-Sessions. Architektur sollte explizite Cleanup-Anforderung für WorkoutSession, TimerState, AudioSettings nennen. |
| R3-L3 | UI Designer | **Light-Mode-Token-Placeholder-Disziplin nicht mandatiert** | "Nachrüstbar wenn Tokens sauber" ist implizit; keine durchsetzbare Regel, dass MVP-Tokens Phase-2-Placeholder-Kommentare haben müssen. |

---

## 4. Schweregrad-Vergleich R2 vs. R3

| Schweregrad | Runde 2 | Runde 3 | Delta |
|-------------|---------|---------|-------|
| 🔴 Blocker | 11 | 8 | −3 |
| 🟠 High | 22 | 23 | +1 |
| 🟡 Medium | — | 19 | — |
| 🟢 Low | — | 3 | — |
| **Gesamt** | **33+** | **53** | — |

Hinweis: Runde 2 trennte nicht explizit zwischen Medium und Low. Runde 3 führt diese Granularität neu ein. Die absoluten Zahlen sind daher nur bedingt vergleichbar; der Schweregrad-Mix zeigt dennoch, dass die verbleibenden Findings weniger fundamental sind als in Runde 1 und 2.

---

## 5. Per-Persona-Sektionen

---

### 5.1 Software Architect

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B1 | Transaktionsgrenzen-Strategie (ADR 010) | ✅ VERIFIZIERT GELÖST | ADR 010 mit tx-pattern Code-Snippet an 3 Stellen vorhanden |
| 2 | B2 | Modul-DAG — 8-Modul-gerichteter Graph | ✅ VERIFIZIERT GELÖST | Alle 8 Module mit Import-Richtungen + eslint-plugin-boundaries |
| 3 | B3 | Prisma Middleware in $transaction | ✅ VERIFIZIERT GELÖST | userId-Injection + ESLint-Regel + Integrationstests |
| 4 | H1 | Cross-Cutting-Concerns (shared/middleware/) | ✅ VERIFIZIERT GELÖST | Ort bestätigt; Middleware-Reihenfolge NICHT in ARCHITECTURE.md |
| 5 | H2 | Dead-Letter-Recovery-Pfad | ✅ VERIFIZIERT GELÖST | Alle 5 erforderlichen Elemente vorhanden |
| 6 | H3 | WorkoutSession als Aggregate-Root | ⚠️ TEILWEISE GELÖST | In R2 entschieden, als "—" markiert, NICHT in ARCHITECTURE.md |
| 7 | M1 | Sunset-Header-Policy (ADR 005) | ✅ VERIFIZIERT GELÖST | RFC 8594 vorhanden |
| 8 | M2 | PrismaClient-Singleton | ❌ NOCH OFFEN | Nicht dokumentiert — Singleton-Entscheidung nie festgeschrieben |
| 9 | L1 | Coverage-Schwellenwerte (80%/60%) | ✅ VERIFIZIERT GELÖST | In CI-Pipeline + Testing-Sektion |

#### Part B: Neue Findings

1. 🟠 **High (R3-H1)** — Middleware-Reihenfolge "Auth→Rate-Limit→Logging→Route-Handler" in R2 entschieden, aber NICHT in ARCHITECTURE.md geschrieben. Falsche Reihenfolge riskiert sicherheitsrelevante Datenlecks in Logs vor Auth.
2. 🟠 **High (R3-H2)** — WorkoutSession-Aggregate-Root-Vertrag vollständig fehlend. Entwickler, die MesocyclusService schreiben, haben keine Anleitung, ob WorkoutSessionRepository direkt aufgerufen werden darf.
3. 🟠 **High (R3-H3)** — `admin`-Modul "imports-all" — operative Constraints, was admin mit diesen Imports TUN darf, undefiniert. Admin wird zum Modul, wo alle Abstraktionsdisziplin kollabiert.
4. 🟡 **Medium (R3-H4 Folge)** — ADR-010-Code-Snippet zeigt `async create(data, tx?)` ohne userId-Parameter, inkonsistent mit "alle Repo-Methoden mit expliziter userId-Injektion".
5. 🟡 **Medium (R3-H5 Folge)** — GDPR-Delete-User: Soft-deleted Exercises, die zu global promoted werden — Anonymisierungs-Transaktionspfad (welcher Service, welche Felder, in $transaction?) architektonisch unspezifiziert.
6. 🟡 **Medium (R3-H6 Folge)** — PrismaClient-Singleton-Speicherort nie dokumentiert. Auf Pi 5 mit 256MB-Limit würden mehrere Instanzen den Connection-Pool erschöpfen.

#### Stärken

- Transaction-Pattern (ADR 010) an 3 Stellen cross-referenziert — schwer zu übersehen
- Dead-Letter-Recovery vollständig über alle 5 Dimensionen spezifiziert
- 8-Modul-DAG als Verzeichnisbaum mit expliziten [importiert: X]-Annotationen geschrieben
- Defense-in-depth-Autorisierung auf 3 unabhängigen Ebenen

#### Offene Fragen

1. Was ist die genaue Middleware-Ausführungsreihenfolge? Läuft CSRF-Check vor oder nach Auth?
2. Darf MesocyclusService WorkoutSessionRepository direkt aufrufen, oder muss es über WorkoutService laufen?
3. Was ist der kanonische PrismaClient-Modul-Pfad (z.B. `src/shared/db.ts`)?

---

### 5.2 Backend Architect

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B3 | Prisma Middleware in $transaction | ✅ VERIFIZIERT GELÖST | userId-Injection + Integrationstests je Tabelle |
| 2 | H4 | OIDC Backchannel-Logout-Endpoint | ✅ VERIFIZIERT GELÖST | /api/v1/auth/backchannel-logout vorhanden |
| 3 | H5 | Session-Tabelle: Indizes + Cleanup-Job | ✅ VERIFIZIERT GELÖST | @@index([userId, expiresAt]) + Cleanup alle 15 Min |
| 4 | H6 | Sliding-Window-Rate-Limiting + Response-Header | ⚠️ TEILWEISE GELÖST | Algorithmus + Header vorhanden; Rate-Limit-Tabellenschema fehlt |
| 5 | H7 | Session max_age (8h User / 1h Admin) | ✅ VERIFIZIERT GELÖST | An zwei Stellen vorhanden |
| 6 | H8 | CSRF Double-Submit-Cookie | ✅ VERIFIZIERT GELÖST | SameSite=Strict + Double-Submit + Origin-Check |
| 7 | M3 | Soft-Delete-Partial-Index für ALLE Tabellen | ⚠️ TEILWEISE GELÖST | Nur exercises-Beispiel gezeigt; kein Statement, dass ALLE Tabellen dies erfordern |
| 8 | M4 | argon2-Parameter (memoryCost 19456) | ✅ VERIFIZIERT GELÖST | Dokumentiert mit Pi-freundlicher Begründung |
| 9 | L2 | Migrations-Rollback-RTO | ✅ VERIFIZIERT GELÖST | 4-Schritt-Runbook vorhanden |

#### Part B: Neue Findings

1. 🔴 **Blocker (R3-B7)** — Backchannel-Logout `logout_token` JWT-Validierung unspezifiziert. Keine JWKS-Verifikation, keine iss/aud/iat/jti-Claim-Validierung. Jeder Aufrufer kann eine Logout-Anfrage fälschen.
2. 🔴 **Blocker (R3-B8)** — CSRF-Token-Ausgabepunkt und Client-Side-Management unspezifiziert. Im SPA-Modus mit adapter-static gibt es keinen Server zur Token-Injektion. Wo wird ausgegeben? Wie holt und sendet die SPA?
3. 🟠 **High (R3-H7)** — Rate-Limit-Tabellenschema nie definiert. DB-basiertes Rate-Limiting erfordert Spaltendefinitionen (user_id-Key, window_start, request_count, Indizes, Cleanup-Mechanismus).
4. 🟠 **High (R3-H8)** — argon2 memoryCost 19456 (19MB) liegt unter OWASP-Minimum (64MB). Begründung "Pi-freundlich" vorhanden, aber keine formelle Risikoakzeptanz oder Security-Trade-off-Bewertung dokumentiert.
5. 🟠 **High (R3-H9)** — `/debug`-Screen exponiert User-IDs ohne Access-Control-Spezifikation. "Versteckt" ist keine Zugriffskontrolle. Muss Admin-only sein, muss in Guard-or-Allowlist erscheinen.
6. 🟠 **High (R3-H10)** — Seed-Dateien von Contributors können Prompt-Injection-Payloads in Exercise-Description-Feldern einbetten. Seeder umgeht das 1000-Zeichen-Limit und die Steuer-Token-Erkennung für Runtime-Inputs.
7. 🟡 **Medium (R3-M1)** — Kein Content-Security-Policy (CSP)-Header in der Security-Tabelle spezifiziert.
8. 🟢 **Low (R3-L1)** — OpenAPI-Spec-Ownership und Update-Prozess undefiniert. Kein CI-Abgleich gegen die laufende Implementierung.

#### Stärken

- Session-Sicherheit ist produktionsreif: Server-seitige Sessions, sofortige Invalidierung, Zwei-Index-Strategie, 8h/1h differenziertes max_age, 15-Min-Cleanup, Backchannel-Logout
- Autorisierung ungewöhnlich rigoros: 3 unabhängige Durchsetzungsebenen
- AI-Sicherheitslage gut durchdacht: Pre-Filter, 1000-Zeichen-Limit, Steuer-Token-Erkennung, injection_detected-Logging
- argon2-Abweichung ist zumindest transparent

#### Offene Fragen

1. Wie wird der logout_token JWT verifiziert — JWKS beim Start mit Rotation, oder inline?
2. Wo wird der CSRF-Token ausgegeben, und was ist der Client-Side-Management-Vertrag der SPA?
3. Ist memoryCost: 19456 per-Instance via Umgebungsvariable konfigurierbar?

---

### 5.3 Mobile App Builder

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B6 | TTS-Resilienz auf iOS | ✅ VERIFIZIERT GELÖST | cancel() vor speak(), voiceschanged, en-US-Fallback — alle 3 vorhanden |
| 2 | H12 | PWA-Install-Erkennung + Banner-Timing | ✅ VERIFIZIERT GELÖST | navigator.standalone + matchMedia beide gelistet, Timing korrekt |
| 3 | H13 | Wake-Lock-Fallback-Entscheidung | ✅ VERIFIZIERT GELÖST | "nicht möglich für iOS <16.4 — UI-Hinweis" explizit |
| 4 | H14 | IndexedDB-Recovery (iOS-15.4-Bug) | ✅ VERIFIZIERT GELÖST | Sentinel-Check → Toast + Resync |
| 5 | M7 | SW networkTimeoutSeconds: 3 | ✅ VERIFIZIERT GELÖST | Network-First+Fallback (3s Timeout) explizit |
| 6 | M8 | iOS 14.0–14.3 User-Agent-Banner | ✅ VERIFIZIERT GELÖST | Banner mit SW-Bug-Begründung gezeigt |
| 7 | L3 | touch-action + overscroll CSS | ⚠️ TEILWEISE GELÖST | Bewusst als Implementierungsdetail zurückgestellt (Entscheidung in R2-Log festgehalten) |

#### Part B: Neue Findings

1. 🔴 **Blocker (R3-B2)** — SW-postMessage an wartenden SW architektonisch fehlerhaft. `navigator.serviceWorker.controller?.postMessage()` adressiert den AKTIVEN SW, nicht den WARTENDEN SW. Der wartende SW empfängt diese Nachricht nicht. Benötigt Redesign: IndexedDB-Flag oder `registration.waiting.postMessage()`.
2. 🔴 **Blocker (R3-B3)** — `current_workout`-Invalidierungsvertrag undefiniert. Keine Spec: Überlebt Browserneustart? SW-Update während des Trainings? Max-Age? Nur bei WorkoutSummary gelöscht? Veraltete Daten aus unvollständigen Sessions werden still neu geladen.
3. 🟠 **High (R3-H11)** — iOS-Mindestversion ambivalent. ARCHITECTURE.md sagt "iOS 14+", aber 14.0–14.3 haben "gravierende" SW-Bugs. "Zeigt ein Banner" ist keine Versions-Policy. Entscheidung: hartes Minimum 14.4+ ODER dokumentierte "Degraded-but-functional"-Akzeptanz.
4. 🟠 **High (R3-H12)** — Auto-Advance + Hintergrundunterbrechung: visibilitychange-Handler synchronisiert Timer, aber nicht die Auto-Advance-Position. Bei 3 Minuten Hintergrund während einer 45-Sekunden-Übung wird die Auto-Advance-Position nicht neu berechnet.
5. 🟠 **High (R3-B5 Folge)** — H11 (PauseScreen=Modal, WorkoutSummary=Route) nicht in ARCHITECTURE.md geschrieben. Betrifft SW-URL-Caching-Strategie direkt.
6. 🟡 **Medium (R3-M3)** — PWA-Install-Banner Boolean-Logik unspezifiziert: soll Banner unterdrückt werden, wenn ENTWEDER navigator.standalone ODER matchMedia true zurückgibt? `isInstalled = standalone || matchMedia` muss angegeben werden.
7. 🟡 **Medium (R3-M4)** — Capacitor Phase 3: keine Datei-Level-Import-Boundary spezifiziert. Kein ESLint no-restricted-globals-Regel verhindert workout-core den direkten Import von Browser-APIs.

#### Stärken

- iOS-Feature-Matrix ist die gründlichste Plattform-Kompatibilitätstabelle — differenziert korrekt 14.0/15/16/16.4+ für jede relevante API
- Date.now()-Delta-Timer-Pattern + visibilitychange ist genau richtig für iOS-Hintergrundlimits
- Device-Service-Abstraktion (ADR 009) ist gut konzipiert für Capacitor Phase 3

#### Offene Fragen

1. SW-Waiting-State-Protokoll: IndexedDB-Flag, das von wartendem SW vor skipWaiting() geprüft wird, oder registration.waiting.postMessage()?
2. current_workout-Lebenszyklus: "gelöscht bei WorkoutSummary-Erreichen" + "gelöscht durch iOS-15.4-Sentinel" + "überlebt Browserneustart" + kein Max-Age? Oder 24h Max-Age?
3. iOS 14.0–14.3: akzeptiert mit Banner (bekannte gravierende Bugs toleriert) oder hartes Minimum 14.4+?

---

### 5.4 Frontend Developer

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B4 | SvelteKit SPA-Mode (adapter-static, ssr=false) | ✅ VERIFIZIERT GELÖST | Explizit in Zeile 327 + 864 |
| 2 | B5 | Dexie.js Schema-Versionierung V1 mit Upgrade-Funktionen | ✅ VERIFIZIERT GELÖST | Beide Anforderungen formuliert |
| 3 | H9 | SW postMessage (WORKOUT_ACTIVE/COMPLETE) | ✅ VERIFIZIERT GELÖST | Vollständiger Code-Block vorhanden (mechanisch fehlerhaft — neue Lücke, siehe R3-B2) |
| 4 | H10 | $state via setContext/getContext (kein Modul-Singleton) | ✅ VERIFIZIERT GELÖST | Alle 3 State-Klassen mit korrektem Scope benannt |
| 5 | H11 | PauseScreen=Modal, WorkoutSummary=Route | ❌ NOCH OFFEN | R2-Log "—". Komponenten-Tabelle ohne Kompositionshierarchie-Info. Keine Routentabelle vorhanden. |
| 6 | M5 | Bundle-Visualizer (rollup-plugin-visualizer) | ⚠️ TEILWEISE GELÖST | "Stats als Artifact" in CI, aber rollup-plugin-visualizer nie genannt |
| 7 | M6 | Error-Boundary (+error.svelte je Route) | ❌ NOCH OFFEN | Nirgends in ARCHITECTURE.md erwähnt |

#### Part B: Neue Findings

1. 🔴 **Blocker (R3-B4)** — Workout-URL-Routing nie entschieden. R2 listete dies als offene Frage, aber kein Entscheidungs-Log-Eintrag existiert. Multi-Route (/workout/exercise/[id]) vs. Single-Route-State-Machine (/workout) ist grundlegend: betrifft SW-Caching, Back-Button-Verhalten, H11 und gesamtes State-Management.
2. 🟠 **High (R3-H13)** — ssr=false + load()-Interaktionsgrenze undefiniert. SvelteKit-SPA-Modus verbietet +page.server.ts, aber Architektur sagt dies nie. Erster Contributor wird +page.server.ts schreiben und einen stillen Build-Überraschungseffekt erleben.
3. 🟠 **High (R3-H14)** — AudioSettingsOverlay Context-Ownership unspezifiziert. "Timer läuft weiter" erfordert TimerState-Zugriff. Funktioniert nur wenn im Layout-Tree gerendert (nicht als Portal). Muss explizit angegeben werden.
4. 🟡 **Medium (R3-M5)** — Prisma-Typ-Isolierung angegeben ("Prisma-Types erreichen niemals das Frontend-Bundle"), aber Enforcement-Mechanismus nicht spezifiziert. Kein ESLint no-restricted-imports-Regelname genannt.
5. 🟡 **Medium (R3-M6)** — JS-Bundle-Budget (<150KB Warnung, <250KB Fail) ohne unterstützende Berechnung. SvelteKit ~40KB + Dexie 20KB + layerchart 15KB = ~75KB Baseline vor App-Code. Eng aber unvalidiert.
6. 🟢 **Low (R3-L2)** — Svelte-5-$effect in Klassen-Bodies ohne $effect.root()-Cleanup: Memory-Leak-Risiko in langen Workout-Sessions. Architektur sollte explizite Cleanup-Anforderung für WorkoutSession, TimerState, AudioSettings nennen.

#### Stärken

- H9 (postMessage-Protokoll) und H10 ($state-Scope) sind direkt implementierbar wie geschrieben
- Dexie.js-V1-Schema + Pflicht-Upgrade-Funktionen ist die korrekte Constraint vor dem Code
- Performance-Budget mit CI-Enforcement (Warnung bei 150KB, Fail bei 250KB, Stats als Artifact) ist selten unter PWA-Architekturen
- Design-Token-System ist umfassend und semantisch benannt

#### Offene Fragen

1. Workout-Routing: Single-Route (/workout) oder Multi-Route (/workout/exercise/[id])?
2. Soll das +page.server.ts-Verbot explizit in ARCHITECTURE.md angegeben werden?
3. Rendert AudioSettingsOverlay im Baum (absolut positionierte Svelte-Komponente) oder als DOM-Portal?

---

### 5.5 Senior Developer

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B10 | Runtime-Env-Validierung (Zod, fail-fast) | ✅ VERIFIZIERT GELÖST | src/config.ts + Zod-Schema + bedingte Anforderungen |
| 2 | B11 | Secret-Scanning (gitleaks first) + Pre-Commit | ✅ VERIFIZIERT GELÖST | Beide vorhanden |
| 3 | H21 | Auth-Guard-Meta-Test | ⚠️ TEILWEISE GELÖST | Testabsicht beschrieben, aber konkrete Form der Allowlist undefiniert — kein Dateipfad, keine Code-Konstante |
| 4 | H22 | Docker-Log-Rotation + Backup-Monitoring | ❌ NOCH OFFEN | Explizit als "—" in R2 markiert. Nicht in ARCHITECTURE.md. Backup-Sektion ohne `logging: driver`-Block. Health-Endpoint-JSON ohne backup-Feld. |
| 5 | M14 | RFC 7807 TypeScript-Interface | ✅ VERIFIZIERT GELÖST | problem-details.ts in Modulstruktur |
| 6 | M15 | Contributor-Onboarding | ✅ VERIFIZIERT GELÖST | setup.sh + exercises.fixture.json referenziert |
| 7 | L1 | Coverage-Schwellenwerte | ✅ VERIFIZIERT GELÖST | In CI-Pipeline + Testing-Sektion |
| 8 | L6 | Mutation-Testing | ✅ VERIFIZIERT GELÖST (zurückgestellt) | Dokumentierter bewusster Aufschub |

#### Part B: Neue Findings

1. 🔴 **Blocker (R3-B1)** — `prisma generate` fehlt in CI-Pipeline vor `tsc`. CI-Reihenfolge ist gitleaks→biome→tsc. Saubere CI-Umgebung hat keine Prisma-Client-Types; `tsc` schlägt bei jedem neuen Checkout fehl. Day-1-Bruch.
2. 🔴 **Blocker (H22 Folge)** — H22 immer noch nicht geschrieben. Docker-Log-Rotation (`logging: driver + max-size + max-file`) fehlt aus docker-compose-Spec. Backup-Failure-Flag fehlt aus Health-Endpoint-JSON. Pi-Disk kann innerhalb von Wochen voll laufen.
3. 🟠 **High (R3-H21)** — Auth-Guard-Allowlist ohne definierte Form. Meta-Test erfordert Enumeration jeder öffentlichen Route, aber Allowlist-Form (TypeScript-const? Runtime-Config? Annotation?) unspezifiziert. Test kann nicht konsistent implementiert werden.
4. 🟠 **High (R3-H22)** — exercises.fixture.json Format und Generierungsprozess undokumentiert. Contributor sieht "für Offline-Dev" ohne Pfad nach vorne. Committed? Durch Script generiert? Welches Schema?
5. 🟠 **High (R3-H23)** — Ollama-Fallback-Verhalten in Dev-Umgebung undokumentiert. Wenn src/config.ts AI_BASE_URL als required definiert, kann Contributor ohne GPU die App nicht starten. Expliziter Dev-Mode nullbarer AI-Config-Pfad erforderlich.
6. 🟡 **Medium (R3-M17)** — `bun run cli`-Interface nicht formal dokumentiert. promote-admin, retry-dead-jobs, restore-exercise erscheinen als Einzeiler ohne Dateipfad, Argumente oder Docker-exec-Anweisungen.
7. 🟡 **Medium (R3-M18)** — Umgebungsspezifische Konfigurationsunterschiede (dev/test/prod) nicht dokumentiert. Kein Test-Datenbank-Setup-Schritt in CI.
8. 🟡 **Medium (R3-M19)** — Test-Fixture-Isolation nicht spezifiziert. Sind Integrationstests transaktional? Separate DATABASE_URL_TEST?

#### Stärken

- CI-Pipeline-Reihenfolge gut durchdacht: gitleaks first, prisma migrate diff als Schema-Drift-Guard vor dem Build
- Rule-based-Fallback teilt validatePlan() mit AI-Pfad — eliminiert fallback-spezifische Bugs
- Zod-Config mit bedingten Anforderungen ist das korrekte Pattern für Multi-Mode-Deployment

#### Offene Fragen

1. H22-Remediation: soll backup-failure ein neues `backup`-Feld im Health-Endpoint sein, oder ein separater Monitoring-Hook?
2. prisma generate: in `prisma migrate dev` in setup.sh falten, aber expliziten Schritt in CI vor tsc hinzufügen?
3. Public-Allowlist-Form: TypeScript `as const`-Array exportiert aus shared/middleware/public-routes.ts?

---

### 5.6 UI Designer

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B7 | Amber-Kontrast WCAG AA | ✅ VERIFIZIERT GELÖST | #fcd34d, 7.4–8.1:1 dokumentiert |
| 2 | H15 | Typografie-Token-Vollständigkeit | ✅ VERIFIZIERT GELÖST | 4 Skalenstufen mit rem + line-height. Font-weight fehlt (neue Lücke) |
| 3 | H16 | Fokusring spezifiziert | ✅ VERIFIZIERT GELÖST | Farbe, Offset, "auf allen 3 Surface-Ebenen" angegeben. Kontrastverhältnis pro Surface nicht berechnet (neue Lücke) |
| 4 | H17 | State-Layer-Tokens | ✅ VERIFIZIERT GELÖST | Hover/Pressed/Disabled alle definiert |
| 5 | H18 | Green Flash spezifiziert | ✅ VERIFIZIERT GELÖST | Scope + Dauer + Easing + reduced-motion-Fallback |
| 6 | M9 | Spacing-Tokens | ✅ VERIFIZIERT GELÖST | --space-1 bis --space-16 (4px-Grid) |
| 7 | M10 | Radius-Tokens | ✅ VERIFIZIERT GELÖST | sm/md/lg/pill mit Werten und Verwendung |
| 8 | M11 | Shimmer + ChipGroup-Selected-State | ✅ VERIFIZIERT GELÖST | Beide vollständig definiert |
| 9 | L4 | Transition-Easing + Z-Index-Hierarchie | ✅ VERIFIZIERT GELÖST | Beide definiert |

#### Part B: Neue Findings

1. 🟠 **High (R3-H15)** — Fokusring-Kontrast numerisch nicht verifiziert pro Surface. WCAG 2.4.11 erfordert 3:1 zwischen Fokusindikator und angrenzendem unfokussiertem Element. Drei Hintergrundwerte (#1a1a2e, #1e2240, #252b4a) × Fokusring #fcd34d — keiner individuell berechnet. Behauptung ist qualitativ ("sichtbar"), nicht quantitativ.
2. 🟠 **High (R3-H16)** — `--color-success` hat keinen Hex-Wert. Auch --color-error und --color-warning haben keine Hex-Werte. Token-Namen existieren; Werte nicht. Kein CSS-Token-File kann geschrieben werden.
3. 🟠 **High (R3-H17)** — Font-Loading-Strategie fehlt. Geist Mono und Inter: kein self-hosted @font-face, kein CDN-Link, keine font-display-Strategie, kein preload. FOUT am Training-Timer konterkariert das erklärte UX-Ziel "verhindert Layout-Jitter".
4. 🟡 **Medium (R3-M7)** — Font-weight fehlt in Typografie-Skala. --text-sm bis --text-xl haben rem/line-height, aber kein Weight. Browser-Standard (400) flacht visuelle Hierarchie ab.
5. 🟡 **Medium (R3-M8)** — ProgressDot 44px-Touch-Target-Mechanismus unspezifiziert. Spec sagt "rein informativ" (nicht-interaktiv), aber UX impliziert Sprung zur Übung. Entscheidung: interaktiv (44px-Target + role="button") oder informativ (kein Target nötig)?
6. 🟡 **Medium (R3-M9)** — OfflineIndicator ohne Position-Token oder Farbschema. "Dezenter Offline-Status (Icon in Ecke)" — welche Ecke? Offset? Welches Farb-Token?
7. 🟡 **Medium (R3-M10)** — Badge-Komponente ohne Farbschema. Global vs. Privat vs. Tag-Badges brauchen visuelle Differenzierung. Kein Token-Assignment.
8. 🟡 **Medium (R3-M11)** — Error/Destructive-Farb-Token fehlt im System. ConfirmDialog und Toast referenzieren Fehlerzustände ohne spezifizierte Farbanwendung.
9. 🟡 **Medium (R3-M12)** — Animations-Specs decken nur Green Flash und Shimmer ab. Modal öffnen/schließen, Toast enter/exit, AudioSettingsOverlay reveal, ChipGroup selection — alle dem Entwickler überlassen.
10. 🟢 **Low (R3-L3)** — Light-Mode-Token-Placeholder-Disziplin nicht mandatiert. "Nachrüstbar wenn Tokens sauber" ist implizit; keine durchsetzbare Regel, dass MVP-Tokens Phase-2-Placeholder-Kommentare haben müssen.

#### Stärken

- Semantische Token-Benennung konsequent angewendet — solide Grundlage für Phase-2-Light-Mode-Pivot
- R2-Resolutionen sind gründlich und präzise (Amber-Verhältnis, State-Layer-rgba, Green Flash mit Scope+Easing+reduced-motion)
- prefers-reduced-motion-Behandlung konsistent auf Token-Ebene
- --touch-target-min: 44px via transparentes Padding + ProgressDot role="status" zeigt echtes WCAG-Bewusstsein

#### Offene Fragen

1. Was sind die Hex-Werte für --color-success, --color-error, --color-warning?
2. Font-Loading: self-hosted WOFF2 mit font-display: optional im SW-Precache?
3. Ist ProgressDot interaktiv (Sprung zur Übung) oder strikt informativ?

---

### 5.7 AI Engineer

#### Part A: Runde-2-Verifikation

| # | R2-ID | Thema | Status | Anmerkungen |
|---|-------|-------|--------|-------------|
| 1 | B8 | JSON-Output-Enforcement (Ollama format:json + Ajv) | ✅ VERIFIZIERT GELÖST | Alle 4 Elemente vorhanden: format:json, Ajv vor semantischer Validierung, invalid_output-Pfad, 3B-Retry |
| 2 | B9 | Injection-Schutz (1000-Zeichen + abort + Admin-Alert) | ✅ VERIFIZIERT GELÖST | Alle 3 Elemente vorhanden |
| 3 | H19 | validatePlan() geteilte Funktion | ✅ VERIFIZIERT GELÖST | Deckt explizit AI-Output UND Fallback ab |
| 4 | H20 | RAG Phase 2 Details | ✅ VERIFIZIERT GELÖST (zurückgestellt) | pgvector aktiviert, Details Phase 2 |
| 5 | M12 | AI-Rate-Limit-Granularität | ✅ VERIFIZIERT GELÖST | Alle 4 Dimensionen dokumentiert |
| 6 | M13 | Contract-Tests für AI-Provider | ✅ VERIFIZIERT GELÖST (zurückgestellt) | Dokumentierter bewusster Aufschub |
| 7 | L5 | prompt_version_id eingefroren bei Job-Erstellung | ⚠️ TEILWEISE GELÖST | In ai_generation_logs vorhanden; NICHT in ai_jobs-Tabellenschema (Einfrierquelle fehlt) |

#### Part B: Neue Findings

1. 🔴 **Blocker (R3-B6)** — Ajv-Schema-Inhalt undefiniert. GeneratePlanOutput-Typ ist referenziert, aber nie spezifiziert. Ajv validiert gegen nichts. Pflichtfelder, Typen, Array-Constraints vollständig absent.
2. 🟠 **High (R3-H18)** — Simplified Prompt für 3B-Modell-Retry undefiniert. Kein Inhalt, kein Speicherort (separater ai_prompts-Eintrag?), keine Definition von "simplified". Retry-Pfad hat keinen Inhalt zum Ausführen.
3. 🟠 **High (R3-H19)** — Unicode-Normalisierung fehlt. Injection-Detection-Patterns matchen nur ASCII. Kyrillische/griechische Homoglyphen (е vs e) umgehen die Erkennung vollständig. Kein NFC/NFKC-Normalisierungsschritt vor der Textverarbeitung.
4. 🟠 **High (R3-H20)** — Keine Guardrail für constraint-verletzende AI-Empfehlungen. Pre-Filter sichert Exercise-IDs, aber validatePlan() vier semantische Checks decken keine constraint-aware Volume/Intensity ab. AI kann 4 Sets bodyweight_squat (tagged "Knieschonend") bei hohem Volumen für einen Nutzer mit Knie-Constraints vorschreiben.
5. 🟡 **Medium (R3-M13)** — prompt_version_id in ai_jobs fehlt. ai_generation_logs hat es, ai_jobs nicht. Wenn bei Job-Erstellung eingefroren, muss die Einfrierquelle ai_jobs sein.
6. 🟡 **Medium (R3-M14)** — Fallback-Rule-Engine-Output-Shape nicht verifiziert als GeneratePlanOutput-kompatibel. Wenn sie abweicht, schlägt validatePlan() bei allen Fallback-Plänen fehl.
7. 🟡 **Medium (R3-M15)** — Health-Endpoint-Flag-Semantik bei invalid_key ambivalent. `aiProviderStatus: "unavailable"` vermischt transienten Ollama-Ausfall mit dauerhaftem ungültigem API-Key.
8. 🟡 **Medium (R3-M16)** — Malformed-JSON-passes-Ajv-Pfad nicht spezifiziert. JSON-valid + Ajv-valid aber semantisch ungültig: konsumiert dies das gemeinsame 2-Retry-Budget oder einen separaten Zähler?

#### Stärken

- AiProviderResult-Union mit typisierten Failure-Reasons macht stille Catch-all-Behandlung architektonisch unmöglich
- Pre-Filter (availableExerciseIds) ist eine strukturelle Sicherheitseigenschaft, kein Runtime-Check — AI kann keine nicht-genehmigten Exercises empfehlen
- prompt_version_id in ai_generation_logs ermöglicht Post-hoc-Prompt-Qualitäts-Regressionsanalyse
- "Niemals invaliden Plan speichern"-Invariante durch gemeinsames validatePlan() für beide Pfade durchgesetzt

#### Offene Fragen

1. Was ist die kanonische Definition von GeneratePlanOutput (Pflichtfelder, verschachtelte Strukturen, Constraints)?
2. Ist der simplified 3B-Prompt ein separater ai_prompts-Eintrag (mit eigenem type-Wert) oder programmatisch generiert?
3. Wird Unicode-Normalisierung (NFC/NFKC) serverseitig auf alle Nutzer-Freitext-Inputs angewendet vor der Textverarbeitung?

---

## 6. Konsolidierte Offene Fragen

Diese Fragen müssen im ARCHITECTURE.md beantwortet werden, bevor der erste Commit erfolgt.

### Gruppe 1: Routing und Navigation (Blocker)

| # | Frage | Beteiligte Personas | Priorität |
|---|-------|---------------------|-----------|
| OQ-1 | Workout-Routing: Single-Route (/workout) oder Multi-Route (/workout/exercise/[id])? | Frontend, Mobile, Software Architect | 🔴 |
| OQ-2 | PauseScreen=Modal oder Route? WorkoutSummary=Route — welche URL? | Frontend, Mobile | 🔴 |
| OQ-3 | Was ist die genaue Middleware-Ausführungsreihenfolge? Läuft CSRF-Check vor oder nach Auth? | Software Architect, Backend | 🔴 |

### Gruppe 2: Service Worker (Blocker)

| # | Frage | Beteiligte Personas | Priorität |
|---|-------|---------------------|-----------|
| OQ-4 | SW-Waiting-State-Protokoll: IndexedDB-Flag oder registration.waiting.postMessage()? | Mobile, Frontend | 🔴 |
| OQ-5 | current_workout-Lebenszyklus: Überlebt Browserneustart? Max-Age? Wann gelöscht? | Mobile, Frontend | 🔴 |

### Gruppe 3: Sicherheit (Blocker / High)

| # | Frage | Beteiligte Personas | Priorität |
|---|-------|---------------------|-----------|
| OQ-6 | Wo wird der CSRF-Token in der SPA ausgegeben? Wie holt und sendet der Client ihn? | Backend | 🔴 |
| OQ-7 | Wie wird logout_token JWT verifiziert — JWKS beim Start mit Rotation, oder inline? | Backend | 🔴 |
| OQ-8 | Ist memoryCost: 19456 via Umgebungsvariable konfigurierbar? Gibt es eine formelle Risikoakzeptanz? | Backend | 🟠 |
| OQ-9 | iOS 14.0–14.3: akzeptiert mit Banner oder hartes Minimum 14.4+? | Mobile | 🟠 |

### Gruppe 4: Datenstruktur und Schema (Blocker / High)

| # | Frage | Beteiligte Personas | Priorität |
|---|-------|---------------------|-----------|
| OQ-10 | Was ist die kanonische Definition von GeneratePlanOutput (Pflichtfelder, verschachtelte Strukturen, Array-Constraints)? | AI Engineer | 🔴 |
| OQ-11 | Was ist der kanonische PrismaClient-Modul-Pfad? | Software Architect, Senior Developer | 🟠 |
| OQ-12 | Was sind die Hex-Werte für --color-success, --color-error, --color-warning? | UI Designer | 🟠 |
| OQ-13 | Darf MesocyclusService WorkoutSessionRepository direkt aufrufen? | Software Architect | 🟠 |

### Gruppe 5: Infrastruktur (Blocker / High)

| # | Frage | Beteiligte Personas | Priorität |
|---|-------|---------------------|-----------|
| OQ-14 | prisma generate: expliziter Schritt in CI vor tsc? | Senior Developer | 🔴 |
| OQ-15 | H22-Remediation: backup-field in health endpoint oder separater Monitoring-Hook? | Senior Developer | 🔴 |
| OQ-16 | exercises.fixture.json: committed oder generiert? Welches Schema? | Senior Developer | 🟠 |
| OQ-17 | Ollama in Dev-Umgebung: nullable AI-Config-Pfad oder separater Dev-Modus? | Senior Developer | 🟠 |

### Gruppe 6: Design-System (High)

| # | Frage | Beteiligte Personas | Priorität |
|---|-------|---------------------|-----------|
| OQ-18 | Font-Loading-Strategie: self-hosted WOFF2 mit font-display: optional im SW-Precache? | UI Designer | 🟠 |
| OQ-19 | Ist ProgressDot interaktiv (Sprung zur Übung) oder strikt informativ? | UI Designer | 🟡 |
| OQ-20 | Rendert AudioSettingsOverlay im Baum oder als DOM-Portal? | Frontend | 🟠 |
| OQ-21 | Ist der simplified 3B-Prompt ein separater ai_prompts-Eintrag oder programmatisch generiert? | AI Engineer | 🟠 |

---

## 7. Implementierungsbereitschaft — Runde-3-Verdict

### Gesamtbewertung

**Status: NICHT BEREIT FÜR DEN ERSTEN COMMIT**

8 Blocker müssen in ARCHITECTURE.md aufgelöst werden. Kein Blocker erfordert einen Architektur-Umbau — alle sind durch Dokumentationsergänzungen und/oder kleine Designentscheidungen lösbar. Nach Auflösung aller Blocker ist das Fundament für eine stabile Implementierung vorhanden.

### Bereitschaft nach Bereich

| Bereich | Bereitschaft | Verbleibende Blocker |
|---------|-------------|----------------------|
| Transaktionsgrenzen (ADR 010) | ✅ Bereit | — |
| Session-Sicherheit | ✅ Bereit | — |
| Modul-DAG + ESLint | ✅ Bereit | — |
| AI-Queue-Design | ✅ Bereit | Ajv-Schema-Inhalt (R3-B6) |
| iOS-Feature-Matrix + TTS | ✅ Bereit | — |
| Design-Token-System | 🟡 Fast bereit | Hex-Werte fehlen (R3-H16) |
| Service-Worker-Protokoll | 🔴 Blocker | SW-postMessage-Mechanismus (R3-B2), current_workout-Vertrag (R3-B3) |
| Workout-Routing | 🔴 Blocker | URL-Routing-Entscheidung (R3-B4), H11 (R3-B5) |
| CSRF + Backchannel-Logout | 🔴 Blocker | Token-Issuance (R3-B8), JWT-Validierung (R3-B7) |
| CI-Pipeline | 🔴 Blocker | prisma generate fehlt (R3-B1) |
| Docker-Betrieb | 🔴 Blocker | Log-Rotation + Backup-Flag (H22-Folge) |

### Vergleich mit Runden 1 und 2

| Dimension | Runde 1 | Runde 2 | Runde 3 |
|-----------|---------|---------|---------|
| Blocker-Anzahl | ~20 | 11 | 8 |
| Konzepte vollständig fehlend | Hoch | Mittel | Niedrig |
| Implementierungsverträge unvollständig | Niedrig | Mittel | Hoch |
| Operative Lücken | Mittel | Mittel | Hoch (spezifischer) |
| Fundament-Stabilität | ⚠️ Fragil | 🟡 Solid | ✅ Stark |

Das Verhältnis von "Konzept fehlt" zu "Vertrag unvollständig" hat sich von Runde zu Runde zu Gunsten des Letzteren verschoben — ein klares Zeichen zunehmender Reife.

---

## 8. Entscheidungs-Log Runde 3

Für jede Entscheidung: Status "Offen" → "Entschieden" → "In ARCHITECTURE.md" eintragen.

| R3-ID | Thema | Entscheidung | Status | Datum |
|-------|-------|--------------|--------|-------|
| R3-B1 | prisma generate in CI | — | Offen | — |
| R3-B2 | SW-postMessage-Mechanismus | — | Offen | — |
| R3-B3 | current_workout-Invalidierungsvertrag | — | Offen | — |
| R3-B4 | Workout-URL-Routing | — | Offen | — |
| R3-B5 | H11: PauseScreen=Modal, WorkoutSummary=Route | — | Offen | — |
| R3-B6 | GeneratePlanOutput Ajv-Schema-Definition | — | Offen | — |
| R3-B7 | logout_token JWT-Validierung (JWKS) | — | Offen | — |
| R3-B8 | CSRF-Token-Issuance-Punkt (SPA-Modus) | — | Offen | — |
| R3-H1 | Middleware-Reihenfolge in ARCHITECTURE.md schreiben | — | Offen | — |
| R3-H2 | WorkoutSession Aggregate-Root Cross-Access-Vertrag | — | Offen | — |
| R3-H3 | admin-Modul operative Constraints | — | Offen | — |
| R3-H7 | Rate-Limit-Tabellenschema | — | Offen | — |
| R3-H8 | argon2 formelle Risikoakzeptanz | — | Offen | — |
| R3-H9 | /debug Access-Control-Spezifikation | — | Offen | — |
| R3-H10 | Seed-Dateien Injection-Risiko Maßnahmen | — | Offen | — |
| R3-H11 | iOS-Mindestversion: 14.4+ oder degraded-functional | — | Offen | — |
| R3-H12 | Auto-Advance + Hintergrundunterbrechung | — | Offen | — |
| R3-H13 | +page.server.ts-Verbot explizit in ARCHITECTURE.md | — | Offen | — |
| R3-H14 | AudioSettingsOverlay Render-Position | — | Offen | — |
| R3-H15 | Fokusring-Kontrast pro Surface numerisch berechnen | — | Offen | — |
| R3-H16 | --color-success/error/warning Hex-Werte | — | Offen | — |
| R3-H17 | Font-Loading-Strategie | — | Offen | — |
| R3-H18 | Simplified 3B-Prompt Inhalt und Speicherort | — | Offen | — |
| R3-H19 | Unicode-Normalisierung (NFC/NFKC) | — | Offen | — |
| R3-H20 | Constraint-aware Volume/Intensity Guardrail | — | Offen | — |
| R3-H21 | Auth-Guard-Allowlist Form | — | Offen | — |
| R3-H22 | H22: Docker-Log-Rotation + Backup-Flag | — | Offen | — |
| R3-H23 | Ollama Dev-Mode nullable AI-Config | — | Offen | — |
| R3-M1 | CSP-Header-Spezifikation | — | Offen | — |
| R3-M3 | PWA-Install-Banner Boolean-Logik | — | Offen | — |
| R3-M4 | Capacitor Phase 3 Import-Boundary | — | Offen | — |
| R3-M5 | Prisma-Typ-Isolierung ESLint-Regel | — | Offen | — |
| R3-M7 | Font-weight in Typografie-Skala | — | Offen | — |
| R3-M8 | ProgressDot: interaktiv oder informativ | — | Offen | — |
| R3-M9 | OfflineIndicator Position + Farbschema | — | Offen | — |
| R3-M10 | Badge-Farbschema | — | Offen | — |
| R3-M13 | prompt_version_id in ai_jobs | — | Offen | — |
| R3-M14 | Fallback-Output-Shape Kompatibilität | — | Offen | — |
| R3-M15 | aiProviderStatus invalid_key vs. unavailable | — | Offen | — |
| R3-M17 | `bun run cli`-Interface-Dokumentation | — | Offen | — |
| R3-M18 | Umgebungsspezifische Konfiguration (dev/test/prod) | — | Offen | — |
| R3-M19 | Test-Fixture-Isolation (transaktional? DATABASE_URL_TEST?) | — | Offen | — |

---

*Dieses Dokument ist das autoritative Ergebnis von Architektur-Review-Runde 3. Alle Findings sind auf Basis von ARCHITECTURE.md nach Runde-2-Überarbeitung erstellt. Nächster Schritt: Entscheidungen für alle 8 Blocker treffen, in ARCHITECTURE.md eintragen, und Runde-4-Verifikation durchführen.*
