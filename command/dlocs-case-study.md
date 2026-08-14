---
description: Produce a Dlocs client success case — strategist brief first, then a polished self-contained HTML case study.
agent: build
---

You are orchestrating the **Dlocs case-study pipeline**, a two-stage handoff between two specialized subagents.

Run the pipeline end to end. Do not skip a stage and do not let one subagent do the other's job.

## Input

`$ARGUMENTS` is the source material for the engagement. It may be:

- One or more file paths (project records, interview notes, briefs, metrics, transcripts).
- A directory of source material.
- Free-text context describing the engagement.

Resolve the input first: if it is a path, read the files. If a path is missing or no usable material is provided, ask the user for it before starting.

## Pipeline

### Stage 1 — Strategist brief

Delegate to the `client-success-case-strategist` subagent via the Task tool. Provide:

- All resolved source material (paths or verbatim content).
- Any user-stated constraints: audience, confidentiality, call to action, publication status.

Request the **Success Case Source Document** exactly per its Markdown Output Contract. Emphasize the verification gates:

- Do not fabricate facts, metrics, quotes, or outcomes.
- If evidence is insufficient, it must return a **Discovery Gap Report** instead of polished copy.
- Output must be a single self-contained English `.md` file following its contract structure.

### Stage 1 review

Before proceeding:

- If the strategist returned a Discovery Gap Report, **stop**. Report the gaps and the requested evidence to the user, list the case-strength score, and do not continue to Stage 2.
- Otherwise verify the brief follows its contract: frontmatter, `## Case at a Glance`, `## HTML Production Brief`, `## Editorial and Evidence Notes`, and a claim registry.
- If the brief is `publication_status: internal-only` or has unresolved blockers that would force the designer to invent content, stop and surface the blockers.

Save the accepted brief to a working file next to the deliverable, named `dlocs-<slug>-case-study.md` using the slug from its frontmatter.

### Stage 2 — HTML production

Delegate to the `dlocs-case-study-html-designer` subagent via the Task tool. Provide:

- The path to the saved Markdown brief (or its verbatim content).
- Any approved assets that are available (logos, screenshots) and where they live.
- The output directory for the HTML file.

Enforce the handoff rules:

- The designer must not rewrite facts, strengthen claims, add quotes, invent metrics, or expose the internal `## Editorial and Evidence Notes`.
- Only content approved under `publication_status: approved` may be published.
- The deliverable is one self-contained HTML5 file named `dlocs-<slug>-case-study.html`, no build step, no external dependencies, print-ready.

### Stage 2 review

Verify the finished artifact before reporting:

- The HTML file exists and has no `TODO`, `TBD`, lorem ipsum, or editorial notes.
- No confidential client details leak through filenames, metadata, or content.
- Facts, qualifiers, and citations match the strategist's brief.
- The file is responsive and self-contained (no broken relative assets).

## Output

Report concisely:

- Paths to the Markdown brief and the HTML case study.
- The case title, client descriptor, and publication status.
- Any sections deliberately omitted and why.
- The next-step CTA as written in the brief.

Ask the user to review the HTML at desktop and mobile sizes and to confirm publication approvals before distribution. Do not commit or publish anything unless explicitly asked.
