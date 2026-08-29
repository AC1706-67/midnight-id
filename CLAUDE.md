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
3. `bboard-ui/` is still written against the upstream bulletin board and does not typecheck. Not in scope for Wave 1; the CLI is the demo surface.
4. The issuer prints the participant card secret to the logger so it can be written onto a card during a demo. This conflicts with D6 (never log the participant secret key). Acceptable for a local demo, must not survive into anything pointed at a real log sink.

## Fixed

- **`enroll` authorization** (was Known repo issue 3). `enroll` had no caller check of any
  kind, so anyone could insert an arbitrary commitment into `credentialTree` and self-enroll
  a credential that then passed `checkIn` and `verifyCredential`. Shipped:
  - `export sealed ledger issuerPk: Bytes<32>`, set from a `constructor(pk: Bytes<32>)`
    parameter via `disclose()`. Sealed, so issuance cannot be moved to another key after
    deployment.
  - `witness issuerSk(): Bytes<32>`, held only by the issuing organization.
    `MidnightIdPrivateState.issuerSecretKey` is `null` on a participant install and the
    witness throws there, so `enroll` fails locally before a proof is attempted.
  - `assert(disclose(publicIssuerPk(issuerSk()) == issuerPk), "not the issuer")` at the top
    of `enroll`. `ownPublicKey()` is prover-supplied and is deliberately not used.
  - `export pure circuit publicIssuerPk(sk)` — issuer key derivation, own domain tag
    (`midnight-id:issuer`) so an issuer key can never collide with a credential leaf.
  - `export pure circuit publicNullifier(sk, date)` — `checkIn` calls it rather than
    inlining the hash, so the app and the circuit cannot drift apart. `checkIn` and
    `verifyCredential` both call `publicCommitment` for the same reason - every hash
    derivation in the contract now has exactly one definition.

  Enforced in-circuit, not just in TypeScript: `enroll.zkir` carries `persistent_hash`,
  `private_input`, `test_eq` and `assert` ops that the old circuit did not have. Covered by
  the `regression: enroll is authorized` block in `contract/src/test/midnight-id.test.ts`.

## Open technical questions — do not fix yet, investigate only when asked

1. `currentDate` is an unconstrained circuit parameter in `checkIn`, so the prover chooses it and can burn multiple nullifiers per real day. Determine whether Compact exposes a trusted time source to bound it against.

## Verified sound — do not "fix"

**Participant session model.** `checkIn` and `verifyCredential` deliberately do NOT clear
private state after proving. The secret is established by `join()` and lives for the
duration of a kiosk session — a participant may check in and then prove a credential — and
is dropped by an explicit `close()` when they walk away. An earlier version cleared in a
`finally` block per call; that destroyed the session secret and made every second operation
fail with "no participant private state". Do not reintroduce per-call clearing. The secret
never reaches disk regardless: `EphemeralPrivateStateProvider` is in-memory only and its
export/import methods throw by design.

**Role split (D1, settled).** Two private state types, not one union. `IssuerPrivateState`
is persistent (LevelDB, own store name); `ParticipantPrivateState` is ephemeral. Cross-role
witness stubs throw. Role is selected at CLI startup, before providers are built, because
the two roles need different private state providers and differently-typed
`NodeZkConfigProvider`s. The verifier role holds no private state and is deliberately not a
CLI mode for Wave 1 — it needs no wallet, seed, or proof server, and `run()` builds the
wallet first. `deriveManoPublicState` is exported for verifier use.

**D3, settled.** `findPathForLeaf(commitment)` is used; leaf index is not tracked.

`checkIn` correctly binds `credentialPath()` to `localSecretKey()` via `assert(path.leaf == commitment)`. Confirmed at the ZKIR wire level. Leave it alone.

## Verified against a running chain

Full flow exercised end to end on a local standalone environment (testkit provisions node,
indexer, and proof server via Docker) with real PLONK proofs:

| Operation | Time |
|---|---|
| deploy | ~19s |
| enroll | ~23s |
| checkIn | ~24s |
| verifyCredential | ~22s |
| second same-day checkIn | rejected in ~44ms |

The rejection is the contract's own `already checked in today` assertion, failing locally
before the proof server is invoked — no fees are spent on a rejected attempt.
`verifyCredential` leaves `totalCheckIns` and the nullifier set unchanged.

Not yet deployed to Preprod.

## Environment

- Windows + WSL2 Ubuntu.
- Node v24.18.0 via nvm.
- compactc 0.31.0, invoked as `compact src/...` not `compact compile`.
- Proof server runs in Docker Desktop.
- Never push to GitHub until the build passes clean.
