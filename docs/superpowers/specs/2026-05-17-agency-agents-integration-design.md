# Design: agency-agents Integration in Claude Code

## Ziel

23 kuratierte Personas aus dem [agency-agents](https://github.com/msitarzewski/agency-agents) Repo nach `~/.claude/agents/` installieren. Die Personas stehen Claude Code danach als automatisch geroutete Sub-Agents sowie zur manuellen Aktivierung zur Verfügung.

## Architektur

Ein idempotentes Shell-Skript (`scripts/install-agents.sh`) klont das Upstream-Repo in ein temporäres Verzeichnis, kopiert die whitegelisteten `.md`-Files nach `~/.claude/agents/` und räumt den Temp-Ordner auf. Das Skript kann jederzeit erneut ausgeführt werden um Updates zu ziehen.

Die Original-Markdown-Dateien werden unverändert übernommen — kein Konvertierungsschritt nötig, da Claude Code das Frontmatter-Format (`name`, `description`, `color`, `emoji`) nativ versteht.

## Kuratierte Persona-Liste (23 Personas)

### Engineering (13)

| Dateiname | Zweck |
|---|---|
| `engineering-software-architect.md` | System- und Architekturentscheidungen |
| `engineering-backend-architect.md` | Bun/Hono API-Schicht |
| `engineering-frontend-developer.md` | PWA / React |
| `engineering-database-optimizer.md` | PostgreSQL-Schema & Queries |
| `engineering-security-engineer.md` | OIDC, Sessions, Auth |
| `engineering-devops-automator.md` | Docker, Coolify, CI/CD |
| `engineering-senior-developer.md` | Generelle Implementation |
| `engineering-code-reviewer.md` | Code-Review |
| `engineering-technical-writer.md` | Docs, README, ADRs |
| `engineering-minimal-change-engineer.md` | Sichere, gezielte Änderungen |
| `engineering-rapid-prototyper.md` | Schnelle Feature-Sketches |
| `engineering-sre.md` | Reliability, Monitoring |
| `engineering-ai-engineer.md` | KI-Features, Prompt-Engineering |

### Design (5)

| Dateiname | Zweck |
|---|---|
| `design-ux-architect.md` | User Flows, Navigation |
| `design-ui-designer.md` | Komponenten, visuelles System |
| `design-ux-researcher.md` | Nutzerverhalten, Usability |
| `design-inclusive-visuals-specialist.md` | Accessibility |
| `design-brand-guardian.md` | Konsistentes Design-System |

### Testing (5)

| Dateiname | Zweck |
|---|---|
| `testing-api-tester.md` | Endpoint-Tests |
| `testing-accessibility-auditor.md` | a11y-Checks |
| `testing-performance-benchmarker.md` | Load, Bundle-Size |
| `testing-reality-checker.md` | Sanity-Checks, Anti-Hype |
| `testing-evidence-collector.md` | Dokumentierte Testergebnisse |

## Installationsmechanismus

**Skript:** `scripts/install-agents.sh`

Ablauf:
1. Repo in `$(mktemp -d)` klonen
2. `~/.claude/agents/` erstellen falls nicht vorhanden
3. Jede whitegelistete Datei kopieren (überschreibt bei erneutem Lauf)
4. Temp-Verzeichnis löschen
5. Anzahl installierter Agents ausgeben

**Idempotent:** Wiederholtes Ausführen aktualisiert bestehende Dateien ohne Seiteneffekte.

## End-State

- `~/.claude/agents/` enthält 23 `.md`-Dateien
- Claude Code erkennt sie beim nächsten Start automatisch
- Sub-Agent-Routing: Claude delegiert passende Aufgaben automatisch an die passende Persona
- Manuelle Aktivierung: `use the Software Architect agent and ...`

## Nicht im Scope

- Automatische Updates (Cron, Watch) — manueller Re-Run des Skripts genügt
- Personas aus anderen Kategorien (marketing, finance, sales, ...)
- Anpassung der Persona-Inhalte selbst
