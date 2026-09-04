# 060 — disposition ledger

Append-only record of every bug-labeled item and how it terminated. wp2 through wp6
each write their rows here as they close, so the goal-level DONE claim is checkable
against posted artifacts instead of memory. Terminality rule: `000_research.md`
§"What terminal means".

Columns: item, work-phase, outcome, evidence (merge sha / issue state / posted URL).

## Bug PRs

| PR | Author | wp | Outcome | Evidence |
|----|--------|----|---------|----------|
| 3430 | ChickenBreast-ky | wp2 | pending | |
| 3420 | ildunari | wp2 | pending | |
| 3405 | adtumk | wp2 | pending | |
| 3401 | agentHits | wp2 | pending | |
| 3403 | ianlyoo | wp3 | pending | must reach MERGED or CLOSED |
| 3432 | luvs01 | wp3 | pending | |
| 3407 | turin-dev | wp3 | pending | |
| 3394 | kremnyi | wp3 | pending | |
| 3388 | zleo-ai | wp3 | pending | |
| 3348 | RHODIZSECURITY | wp3 | pending | supersede; needs Co-authored-by |
| 3332 | full999 | wp3 | pending | |
| 3325 | luvs01 | wp3 | pending | needs maintainer sponsorship |

## Bug issues

| Issue | wp | Outcome | Evidence |
|-------|----|---------|----------|
| 3428 | wp2 | pending | closes on #3430 merge |
| 3400 | wp2 | pending | closes on #3401 merge |
| 3378 | wp2 | pending | closes on #3405 merge |
| 3402 | wp3 | pending | closes on #3403 merge |
| 3406 | wp3 | pending | tied to #3407 |
| 3425 | wp4 | pending | |
| 3352 | wp4 | pending | security-review class |
| 3433 | wp5 | pending | provenance decision required |
| 3424 | wp5 | pending | |
| 3320 | wp6 | pending | local Windows repro permitted |
| 3279 | wp6 | pending | |
| 3255 | wp6 | pending | reclassify to enhancement |
| 3245 | wp6 | pending | upstream-tracking |
| 1527 | wp6 | pending | |

## Rules for writing a row

- `merged` requires the dev merge sha from `gh pr view --json mergedAt` plus the issue
  showing CLOSED afterwards (these PRs target `dev`, so GitHub does not auto-close).
- `superseded` requires the successor PR number AND the `Co-authored-by` trailer text,
  quoted, so the credit claim is verifiable in git rather than asserted in prose.
- `needs-human` / `blocked` / `unsafe` requires the posted comment URL. An outcome with
  no artifact on the item is not a disposition.
- A Windows-only failure discovered while working an item gets its own filed issue number
  recorded in the row, per the goal's scope rule.

