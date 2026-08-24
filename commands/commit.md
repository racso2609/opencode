let---
description: Review staged diff and generate a terse commit message
---
1. Inspect staged diff (`git diff --cached`).
2. Run quick style & convention check on staged changes (flag 🔴 critical / 🟡 warn issues if any).
3. If blockers found, report them before committing.
4. Generate Conventional Commit message (subject ≤50 chars, imperative, explain why over what).
