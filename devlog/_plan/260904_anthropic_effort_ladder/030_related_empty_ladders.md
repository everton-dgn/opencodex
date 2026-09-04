# 030 — Related: other rows advertising no effort ladder

Work phase: wp4. Consumes 020. Investigation first; a fix only where evidence
supports one.

## Candidates from the live catalog

`GET /v1/models` on 2026-09-04 returned an empty ladder for three rows besides
the Anthropic ones. Two are genuine candidates:

| Row | Provider block state |
|---|---|
| `lidge/qwen3.8-27b-nvfp4` | no `models` key, no `modelReasoningEfforts` |
| `opencode-free/muse-spark-1.2-contributor-free` | `modelReasoningEfforts` declares `deepseek-v4-flash-free` only |

## The question to answer for each

Not "does it have a ladder" — the catalog already answers that. The question is
whether the ADAPTER would honor an effort if one were declared, which is what
made the Anthropic case a safe fix. An empty ladder on a model whose adapter
ignores or rejects effort is CORRECT, and adding one there would advertise a
control that silently does nothing.

So for each candidate:

1. Which adapter serves it, and does that adapter have an effort path?
2. Is the model reasoning-capable at all, per its own vendor surface?
3. Is it excluded on purpose (a `noReasoningModels` entry, a deliberate empty
   `reasoningEfforts: []`)? Several providers in the registry declare
   `reasoningEfforts: []` explicitly, which is a positive statement of "no
   reasoning", not an oversight.

`lidge` is a local/self-hosted block with `allowPrivateNetwork` and an API-key
pool, so its capabilities depend on the deployed server rather than a vendor
contract — a ladder claim there needs a live probe, not a guess.

## Disposition rule

- Adapter honors effort AND the model reasons -> same fix shape as 010, but as
  its own change with its own evidence. It does NOT ride along in the Anthropic
  PR; a reviewer evaluating a Claude fix should not have to also adjudicate an
  unrelated provider's capabilities.
- Adapter ignores effort, or capability is unproven -> report to the user with
  the evidence and leave the catalog honest. An unproven ladder is a worse defect
  than a missing one, because the control appears to work.

## Deliverable

A written finding per candidate naming the adapter, the capability evidence, and
the verdict. Reported to the user regardless of whether any code changes.
