# MANO — Anonymous Check-In Credentials

A zero-knowledge credential system that lets someone prove they showed up, without
revealing who they are.

Built on Midnight with Compact. Submitted to the Midnight Buildathon, Wave 1.

---

## The problem

Substance use records in the United States are governed by [42 CFR Part 2](https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2),
a federal privacy rule stricter than HIPAA. It exists because of a specific harm: people
avoid seeking help when doing so creates a permanent record that can follow them into
housing applications, employment screening, custody proceedings, and criminal
proceedings.

That rule reaches further than most people assume. It covers any federally assisted
program that holds itself out as providing SUD diagnosis, treatment, or referral for
treatment: detox facilities, residential and outpatient treatment, opioid treatment
programs and other MAT clinics, identified SUD units inside general hospitals and
correctional facilities, and drop-in centers that refer people into treatment. Referral
alone is enough to trigger it, and an OTP qualifies through its dispensing authority
regardless of funding source.

All of them share the same tension. They need to count visits — funders require it, and
services are allocated on it — while the people walking through the door often have
concrete reasons not to be counted by name.

The usual answer is a policy promise: we collect your name but we protect it. That
promise is only as strong as the institution holding the database, its access controls,
its staff turnover, and whatever subpoena arrives later.

MANO replaces the promise with math. The organization can prove someone enrolled showed
up today. It cannot learn which enrolled person that was, and neither can anyone reading
the chain.

## Design constraints from the field

This is built for a specific operating environment, and the constraints drove the
architecture more than the cryptography did.

**No smartphones.** Roughly half the intended participants are in an unhoused situation.
A phone-based credential excludes the people who need the service most. The Phase 1
credential is a physical card carrying a 32-byte secret, scanned at a kiosk tablet at the
front desk.

**Issuer and participant share a device.** In a drop-in center there is one tablet, and
staff and participants both use it, sometimes minutes apart. That co-location is the
argument for separating the two roles in code rather than merging them — a shared private
state store would accumulate participant secrets on a tablet sitting in a public room.

**Nobody trusts the operator by default, and they shouldn't have to.** The privacy
property has to hold against the organization running the system, not just against
outsiders.

---

## How it works

### Enrollment

Staff generate a 32-byte secret, compute a commitment from it, and insert the commitment
into an on-chain Merkle tree. The secret is written to the participant's card and
discarded — it never enters the issuer's private state, and staff never see it associated
with a name.

```
commitment = persistentHash([pad(32, "midnight-id:commitment"), sk])
```

`enroll` is authorized. The issuer public key is pinned in the constructor as a `sealed`
ledger field, and the circuit asserts that the caller holds the matching secret:

```compact
assert(disclose(publicIssuerPk(issuerSk()) == issuerPk), "not the issuer");
```

Without that check anyone could insert an arbitrary commitment and mint themselves a
credential that passes every downstream circuit. Note that `ownPublicKey()` is
prover-supplied local state and provides no cryptographic binding, so it is deliberately
not used for authorization. Compact 0.31.0 has no signature-verification builtin and no
`msg.sender`; authorization here is a sealed field pinned at deployment plus a witness
secret plus an in-circuit assertion.

### Check-in

The participant scans their card. The client fetches the current Merkle path for their
commitment from the indexer, and the circuit proves three things at once: that the
commitment is in the tree, that the prover knows the secret behind it, and that today's
nullifier has not been spent.

```
nullifier = persistentHash([pad(32, "midnight-id:nullifier"), sk, currentDate])
```

The domain separators are load-bearing, not decorative. Without distinct tags, a
commitment and a nullifier derived from the same secret could collide across contexts.

The soundness-critical line binds the witness-supplied path to the witness-supplied
secret:

```compact
assert(path.leaf == commitment, "path does not match credential");
```

Without it, a prover holding their own valid secret could submit somebody else's Merkle
path. Verified at the ZKIR wire level: ops 44/45 constrain the leaf wires equal to the
commitment wires, and op 49 folds those same wires into the root.

### Verification

A third party — a housing provider, an employer, a court — can be shown a proof that the
holder has a valid enrolled credential, without learning which one. `verifyCredential`
leaves the check-in counter and the nullifier set untouched; it is a membership proof, not
an attendance event.

### Ledger state

```compact
export ledger credentialTree: HistoricMerkleTree<10, Bytes<32>>;
export ledger usedNullifiers: Set<Bytes<32>>;
export ledger enrollmentCount: Counter;
export ledger totalCheckIns: Counter;
export sealed ledger issuerPk: Bytes<32>;
```

A depth-10 tree holds 1024 credentials and proves faster than a deeper one.
`HistoricMerkleTree` accepts prior roots, so a path fetched before the tree grew is still
valid — which matters because the tree changes every time anyone enrolls.

---

## What is private and what is not

Being precise about this is more useful than claiming everything is hidden.

**Hidden:** participant identity, the card secret, which credential checked in, the link
between any two check-ins by the same person, the link between enrollment and any
subsequent check-in.

**Public:** how many credentials exist, how many check-ins have occurred, how many
nullifiers have been spent, the issuer's public key, and the timing of each transaction.

**Leaked by timing.** Transactions are visible as they land. An observer watching the
chain in real time, who can also see the front door of a specific building, can correlate
the two. Zero-knowledge proofs do not hide that a transaction happened. Batching or
delayed submission would mitigate this and is not implemented.

**Prover-supplied date.** `currentDate` is a circuit parameter, not a trusted time
source. A dishonest prover can pass a different date and burn more than one nullifier per
real day. This bounds what the check-in count means: it is a count of distinct
(credential, claimed-date) pairs, not a count of physical visits. Compact 0.31.0 exposes
no trusted clock to constrain it against. Documented rather than hidden.

---

## Role separation

Three roles, two private state types, and one deliberate omission.

| Role | Private state | Storage | Circuits |
|---|---|---|---|
| Issuer | `IssuerPrivateState` | LevelDB, own store | `enroll` |
| Participant | `ParticipantPrivateState` | In-memory only | `checkIn`, `verifyCredential` |
| Verifier | none | none | reads ledger state |

The Compact-generated `Witnesses<PS>` type requires all three witnesses regardless of
role, so each role's witness object supplies throwing stubs for the witnesses it must not
have. An issuer build cannot produce a participant secret; a participant build cannot
produce the issuer key. The trust boundary is a runtime assertion, not a comment.

`EphemeralPrivateStateProvider` backs the participant with a `Map` and nothing else. Its
export and import methods throw by design — a provider whose purpose is keeping
participant secrets off disk should have no serialization path at all.

The participant secret lives for one kiosk session: scanned, used for one or more proofs,
then dropped by an explicit `close()`. An earlier version cleared it in a `finally` block
after every proof, which destroyed the session and made any second operation fail. The
session boundary is where the participant walks away, not where a proof completes.

The verifier is not a CLI mode in this submission. It needs no wallet, seed, or proof
server, while the CLI builds a wallet before anything else; wiring a wallet-free path was
not worth the complexity for a role that reads two public counters.
`deriveManoPublicState` is exported for it.

---

## Verification status

Everything below was exercised end to end against a local Midnight stack — node, indexer,
and proof server in Docker — with real PLONK proofs, not simulator runs.

| Operation | Result | Time |
|---|---|---|
| deploy | contract deployed, issuer key pinned | ~19s |
| enroll | credential inserted, `enrollmentCount` 0 → 1 | ~23s |
| checkIn | `totalCheckIns` 0 → 1, nullifier spent | ~24s |
| verifyCredential | proof accepted, counters unchanged | ~22s |
| checkIn (same card, same day) | **rejected** | ~44ms |

The rejection is worth reading carefully. It is the contract's own
`already checked in today` assertion, and it fires **locally, before the proof server is
invoked** — 44 milliseconds against 24 seconds. Circuit execution happens client-side
first, so an invalid attempt costs the participant nothing and never reaches the network.
That is a property of Midnight's execution model rather than anything clever here, but it
is the difference between a kiosk that fails instantly and one that charges someone a fee
to be told no.

Contract-level: 3 impure circuits plus 3 pure circuits, compiling clean on compactc
0.31.0. 11 tests passing, including a mutation-tested regression covering `enroll`
authorization.

| Circuit | k | rows |
|---|---|---|
| `checkIn` | 14 | 10945 |
| `verifyCredential` | 13 | 6742 |
| `enroll` | 13 | 2299 |

**Not deployed to Preprod.** Wallet sync does not complete against Preprod on
wallet-sdk-facade 4.0.1: heap grows without bound and the process dies at ~1.6GB on Node
defaults, ~6.6GB with an 8GB limit, still unfinished after three hours, with repeated
`Wallet.Sync` failures. This is [midnight-wallet #405](https://github.com/midnightntwrk/midnight-wallet/issues/405),
acknowledged upstream — large initial backlog, RPC disconnects, 40–60+ minute first sync.
The relevant knob (`batchUpdates.size`, defaulting to 10 events per batch) exists in the
SDK sync config but is not reachable through `FluentWalletBuilder`.

Two smaller issues found in testkit-js 4.1.1 along the way: the environment health check
uses a 1000ms axios timeout, and cold TLS to the Preprod indexer takes ~5.7s, so it fails
on first connection every time; and `FaucetClient.requestTokens` posts a hardcoded dummy
captcha token that the faucet rejects with `400 decoding_error`.

---

## Running it

Requires Node 24, Docker, and compactc 0.31.0.

```bash
npm install
npm run compact --workspace=contract
npm run build --workspace=api
npm run build --workspace=bboard-cli
npm run standalone --workspace=bboard-cli
```

The standalone launcher provisions node, indexer, and proof server containers and funds a
genesis wallet, so no faucet or network access is needed.

Then, in the CLI:

1. Role `1` (issuer) — press Enter to generate an issuer key, `1` to deploy, `1` to
   enroll. Save the contract address and the card secret it prints.
2. Role `3` to leave issuer mode, then role `2` (participant) — paste the contract
   address and card secret.
3. `1` to check in. `1` again to watch the same-day rejection.

---

## Honest limitations

**Card loss is credential loss.** The card carries the secret; there is no recovery path.
Re-enrollment issues a new secret and a new leaf, and prior check-ins become unprovable by
that person. Acceptable for counting visits. Not acceptable for a milestone credential
that has to survive to reach a housing provider, which is a Phase 2 problem.

**The issuer key is a single point of failure.** Whoever holds it can enroll arbitrary
commitments. One key per device limits the blast radius; there is no revocation.

**The demo CLI prints the card secret to the logger** so it can be written onto a card by
hand. That is correct for a local demo and wrong anywhere a real log sink is attached.

**`currentDate` encoding is duplicated** between the CLI and the contract rather than
single-sourced. They currently agree; nothing enforces that they continue to.

**Packaging still carries upstream names.** Workspaces are named `bboard-*` and some
inherited metadata remains. The compiled asset path and the ZK config path are coupled and
have to move together, so the rename is deliberately a separate change rather than
something rushed before submission.

---

## Why this is not just an attendance tracker

The credential is designed to be soulbound — non-transferable, belonging to the person who
earned it. The Phase 1 property is narrow: prove enrollment, prove a check-in. The reason
to build it on a chain rather than in a database is that the proof outlives the
institution. A drop-in center can close, lose its funding, or lose its records. A
credential that only exists in an organization's database dies with the organization.

Recovery is one of the few areas where a person's history is both the most valuable thing
they have and the most dangerous thing to disclose. Building the system so that disclosure
is mathematically impossible rather than administratively discouraged is the entire point.

---

## License

Apache 2.0. See [LICENSE](./LICENSE).
