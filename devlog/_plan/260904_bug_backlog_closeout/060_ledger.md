# 060 — disposition ledger

Append-only record of every bug-labeled item and how it terminated. wp2 through wp6
each write their rows here as they close, so the goal-level DONE claim is checkable
against posted artifacts instead of memory. Terminality rule: `000_research.md`
§"What terminal means".

Columns: item, work-phase, outcome, evidence (merge sha / issue state / posted URL).

## Bug PRs

| PR | Author | wp | Outcome | Evidence |
|----|--------|----|---------|----------|
| 3430 | ChickenBreast-ky | wp2 | MERGED | dev 4b53e1044f52e8e045db44c8b52613174cf64a23, 2026-09-04T06:51:20Z |
| 3420 | ildunari | wp2 | MERGED | dev fc70555f3692400a6054d1d1aebf9e30bbd08868, 2026-09-04T06:53:36Z |
| 3405 | adtumk | wp2 | MERGED | dev 20011a1c482c1e4051c2ec1c52d0ee9ca9164d6c, 2026-09-04T06:54:29Z |
| 3401 | agentHits | wp2 | MERGED | dev 0f2e1209937ffae9d0c6c30837ce770b3c7cd73c, 2026-09-04T06:52:48Z |
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
| 3428 | wp2 | CLOSED completed | closed after 4b53e104; comment quotes the merge sha |
| 3400 | wp2 | CLOSED completed | closed after 0f2e1209; launcher-coverage follow-up noted |
| 3378 | wp2 | CLOSED completed | closed after 20011a1c; absorbed #3344/#3362 already closed |
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

## wp2 execution record

Merged in the audited order 3430 -> 3401 -> 3420 -> 3405, squash, targeting `dev`.
Each PR was approved by the maintainer as an ordinary review rather than through the
admin `pull_request` bypass, because the maintainer authored none of the four and
MAINTAINERS.md treats a bypass as something that must be recorded rather than assumed.
Each approval carries the substantive finding from the independent review lane, including
the two MERGE-WITH-NOTE caveats: #3405's suite failures attributed to its `dev` baseline
(recorded, not re-litigated, since hosted CI on the PR was green and the local suite was
off-limits) and #3401's partial launcher coverage.

Mergeability was re-confirmed on #3405 AFTER #3420 landed, since both touch
`src/adapters/openai-responses.ts`; it stayed `MERGEABLE`, which is the empirical
confirmation of the independence the audit predicted from the hunk positions.

Not merged from the green set: #3403, held back for the dotted-alias collision and
carried into wp3 as a named item.
