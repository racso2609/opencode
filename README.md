# opencode config

Global [opencode](https://opencode.ai) configuration for this machine.

## Layout

| Path | Purpose |
| --- | --- |
| `opencode.json` | Global config: MCP servers (`drive-local`, `headroom`, `serena`), provider setup. |
| `AGENTS.md` | Session instructions (CodeGraph, RTK token-optimized commands). |
| `agents/` | Custom agents: the software delivery team plus the Dlocs case-study agents. |
| `command/` | Custom slash commands. |
| `drive-local/` | Local Google Drive MCP server (see its own README). |

## Software delivery team

A team of subagents orchestrated by a main agent for hands-on software work.

### Main agent

- **`orchestrator`** (`agents/orchestrator.md`) — primary mode
  The accountable lead for a software task. It receives the request and
  delegates SDD creation, design review, implementation, testing, code-style
  review, and SDD finalization to the subagents, with human-in-the-loop
  checkpoints after SDD creation, testing, and final verification. Selectable
  in the agent picker; optionally set as `default_agent` in `opencode.json`.

### Subagents

- **`sdd-author`** (`agents/sdd-author.md`)
  Authors the Software Design Document that drives the entire pipeline. At
  Stage 1, explores the codebase and produces the initial SDD (replacing the
  traditional planner): requirements, approach, task list with dependencies,
  per-task verification steps, and a decision log. At Stage 7, finalizes the
  SDD with implementation, test, and review results, producing a durable proof
  artifact.

- **`backend-designer`** (`agents/backend-designer.md`)
  Designs backend architecture, data models, and API contracts against the
  codebase's established conventions — service boundaries, migration safety,
  error semantics, and security.

- **`ui-designer`** (`agents/ui-designer.md`)
  Guides UI and front-end work against a consistent design system — tokens,
  components, layout, responsiveness, and WCAG accessibility — and reviews
  existing interfaces for conformance.

- **`code-generator`** (`agents/code-generator.md`)
  Turns the SDD's task list into production code, following the codebase's
  own conventions, and verifies each step with the project's build, lint,
  typecheck, and format commands.

- **`qa-tester`** (`agents/qa-tester.md`)
  Designs the test approach, writes and runs tests against the project's own
  framework, and reports failures with reproduction detail instead of fixing
  production code.

- **`code-style-reviewer`** (`agents/code-style-reviewer.md`)
  Final gate: checks the change against the project's own conventions, runs the
  configured lint/typecheck/format commands, and flags maintainability and
  security issues with file-and-line references.

### Standard pipeline

`orchestrator` runs: SDD creation (`sdd-author`) → **human approval** → design
review (`backend-designer` and/or `ui-designer`, by domain) → implement
(`code-generator`) → test (`qa-tester`) → **human approval** → review
(`code-style-reviewer`) → verify and report → **human approval** → SDD
finalization (`sdd-author`).

## Dlocs case-study pipeline

Two-stage orchestration that turns raw engagement material into a polished,
evidence-based HTML case study for Dlocs.

### Subagents

- **`client-success-case-strategist`** (`agents/client-success-case-strategist.md`)
  Develops evidence-based B2B client success cases: it converts project
  records, interviews, metrics, testimonials, and technical delivery details
  into a persuasive English Markdown brief (per its Markdown Output Contract)
  that a downstream agent can reliably transform into HTML. It never fabricates
  facts, classifies every claim's evidence strength, and returns a Discovery Gap
  Report instead of copy when evidence is insufficient.

- **`dlocs-case-study-html-designer`** (`agents/dlocs-case-study-html-designer.md`)
  Transforms the approved English Markdown brief into a polished, responsive,
  print-ready, self-contained HTML5 case study using the Dlocs visual identity.
  It preserves the facts and qualifiers from the brief, keeps internal editorial
  notes private, and delivers one file with no build step or external
  dependencies.

### Orchestration command

- **`/dlocs-case-study <source-material-or-paths>`** (`command/dlocs-case-study.md`)
  Runs the full pipeline: Stage 1 delegates the source material to the
  strategist to produce the Markdown brief (stopping with a gap report if
  evidence is insufficient), then Stage 2 hands the brief to the HTML designer
  to produce `dlocs-<slug>-case-study.html`. It enforces the handoff contract
  between the two agents and verifies the finished artifact.

## Notes

Config is loaded once at startup. After editing any file here, restart opencode
for changes to take effect.
