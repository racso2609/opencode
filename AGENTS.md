<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tools** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them. `codegraph_node` returns one symbol's source + callers, or reads a whole file with line numbers. If the tools are listed but deferred, load them by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` and `codegraph node <symbol-or-file>` print the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

<!-- engram:memory-protocol -->
## Engram Persistent Memory — Protocol

You have access to Engram, a persistent memory system that survives across sessions and compactions.

### WHEN TO SAVE (mandatory — not optional)

Call `mem_save` IMMEDIATELY after any of these:
- Bug fix completed
- Architecture or design decision made
- Non-obvious discovery about the codebase
- Configuration change or environment setup
- Pattern established (naming, structure, convention)
- User preference or constraint learned

Format for `mem_save`:
- **title**: Verb + what — short, searchable (e.g. "Fixed N+1 query in UserList", "Chose Zustand over Redux")
- **topic_key**: Short lowercase topic identifier
<!-- /engram:memory-protocol -->

<!-- caveman-begin -->
Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan-lite|wenyan-full|wenyan-ultra
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
<!-- caveman-end -->

<!-- agents:paths-begin -->
## Explicitly Registered Agent Paths

Custom subagent and orchestrator definitions:

- **Base Directory**: `/Users/racso/.agents/agents` (symlink: `/Users/racso/.gemini/config/agents`)

### Agents List:
- **orchestrator** (Primary / Orchestrator): `/Users/racso/.agents/agents/orchestrator/agent.md`
  - Mode: Primary coordination agent (T0-T3 classification, delegation)
- **sdd-author** (Subagent): `/Users/racso/.agents/agents/sdd-author/agent.md`
  - Mode: Software Design Document author and proof artifact finalizer
- **backend-designer** (Subagent): `/Users/racso/.agents/agents/backend-designer/agent.md`
  - Mode: Backend architecture, data models, API contracts, migrations, auth
- **ui-designer** (Subagent): `/Users/racso/.agents/agents/ui-designer/agent.md`
  - Mode: UI/front-end design system, tokens, layout, WCAG accessibility
- **code-generator** (Subagent): `/Users/racso/.agents/agents/code-generator/agent.md`
  - Mode: Implementation from SDD task list, conventions, build/lint checks
- **qa-tester** (Subagent): `/Users/racso/.agents/agents/qa-tester/agent.md`
  - Mode: Test strategy, test suites, test runs, reproduction bug reports
- **code-style-reviewer** (Subagent): `/Users/racso/.agents/agents/code-style-reviewer/agent.md`
  - Mode: Final review gate for style, lint, type-check, security smells
- **client-success-case-strategist** (Subagent): `/Users/racso/.agents/agents/client-success-case-strategist/agent.md`
  - Mode: B2B client success briefs from source records, metrics, interviews
- **dlocs-case-study-html-designer** (Subagent): `/Users/racso/.agents/agents/dlocs-case-study-html-designer/agent.md`
  - Mode: HTML5 responsive case study design and generation
<!-- agents:paths-end -->

<!-- subagent-lifecycle-begin -->
## Subagent Lifecycle — Invocation Protocol (CLI & IDE)

**CRITICAL: Never use `send_message` to create subagents. It only communicates with already-running subagents using their active conversation ID (UUID).**

### Tools & Their Purpose

| Tool | Action | When to use |
|------|--------|-------------|
| **`invoke_subagent`** | **Spawns** a new subagent | Creating a new subagent to delegate work |
| **`send_message`** | **Sends message** to an existing subagent | Follow-up with running subagent (needs conversation ID) |
| **`manage_task`** | **Lists/kills/checks** background tasks | Monitoring or terminating subagents |

### `invoke_subagent` Parameters

- **`Prompt`** (string, required): Clear, detailed task description and instructions for the subagent.
- **`Role`** (string, required): Specialized role (e.g., "Code Generator", "SDD Author").
- **`TypeName`** (string, required): Subagent type name (`code-generator`, `sdd-author`, `qa-tester`, `backend-designer`, `ui-designer`, `code-style-reviewer`, etc.). Use `"self"` only if cloning parent agent.
- **`Workspace`** (string): `inherit` | `branch` | `share` (default `inherit`).

<!-- subagent-lifecycle-end -->
