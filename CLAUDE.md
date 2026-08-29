# CLAUDE.md

## Project

MANO — anonymous ZK check-in credentials for peer recovery services.

- Privacy exists because 42 CFR Part 2 governs substance use records: seeking help must not create a permanent externally-controlled record.
- Participants are largely in an unhoused situation; roughly half have no smartphone, so a physical card is the Phase 1 credential.

## Terminology — strict, no exceptions

Applies everywhere, including code comments and READMEs.

| Use | Never |
|---|---|
| Naloxone | Narcan |
| Participants | clients, patients |
| Compassionate care / peer recovery services | harm reduction |
| Unhoused situation | homelessness |
| Wellness supplies | harm reduction supplies |

## Submission constraint — critical

This repo will be submitted publicly. No organization name, address, or leadership names may appear anywhere in this repo or any linked material. If you encounter one: flag it, do not commit it.

## Buildathon requirements

- Midnight Buildathon on AKINDO. Wave 1 build window closes Sep 16 2026.
- Judged by the Midnight Network core team.
- Rubric weight: Engineering 40, QA 15, Product 15, UX 15, Communication 10, BizDev 5.
- Requires: fresh standalone repo, Apache 2.0 license, `midnightntwrk` GitHub topic, README, slide deck, demo video.
- At least one Compact contract must compile — otherwise automatic disqualification.

## Known repo issues

1. Packaging is still upstream example-bboard: root package name, `bboard-cli` / `bboard-ui` / `bboard-contract` workspaces, `bboard.compact` filename, and inherited CODEOWNERS / CHANGELOG / SECURITY.md. Judges authored the original. Needs renaming.
2. `contract/src/managed/` and `contract/dist/` contain committed prover and verifier keys and build output. Should be gitignored.
3. RESOLVED — `enroll` is unauthenticated. It has no caller check of any kind, so anyone can insert an arbitrary commitment into `credentialTree` and self-enroll a credential that then passes `checkIn` and `verifyCredential`. Fix: a `sealed ledger issuerPk: Bytes<32>` set in the `constructor` (needs `disclose()`), an `issuerSk()` witness, and `assert(persistentHash(...issuerSk()) == issuerPk)` at the top of `enroll`. Note `ownPublicKey()` is prover-supplied and must not be used for this.

## Open technical questions — do not fix yet, investigate only when asked

1. `currentDate` is an unconstrained circuit parameter in `checkIn`, so the prover chooses it and can burn multiple nullifiers per real day. Determine whether Compact exposes a trusted time source to bound it against.

## Verified sound — do not "fix"

`checkIn` correctly binds `credentialPath()` to `localSecretKey()` via `assert(path.leaf == commitment)`. Confirmed at the ZKIR wire level. Leave it alone.

## Environment

- Windows + WSL2 Ubuntu.
- Node v24.18.0 via nvm.
- compactc 0.31.0, invoked as `compact src/...` not `compact compile`.
- Proof server runs in Docker Desktop.
- Never push to GitHub until the build passes clean.
