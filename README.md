# opencode config

Global [opencode](https://opencode.ai) configuration for this machine.

## Layout

| Path | Purpose |
| --- | --- |
| `opencode.json` | Global config: MCP servers (`drive-local`, `headroom`, `serena`), provider setup. |
| `AGENTS.md` | Session instructions (CodeGraph, RTK token-optimized commands). |
| `agents/` | Custom subagents. |
| `command/` | Custom slash commands. |
| `drive-local/` | Local Google Drive MCP server (see its own README). |

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
