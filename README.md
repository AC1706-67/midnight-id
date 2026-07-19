# Midnight ID 🌙

**Portable anonymous credentials for community service organizations — built on Midnight.**

Built fresh during the MLH Midnight Hackathon (July 17–19, 2026).

## The problem

Community organizations — drop-in centers, peer recovery services, shelters, Naloxone distribution hubs — need to know that the person in front of them is enrolled, eligible, and showing up. But for the people they serve, being *on a list* can cost a job, housing, or custody. Federal privacy law (42 CFR Part 2) exists precisely because a substance-use service record is one of the most dangerous pieces of paper a person can have.

Today organizations choose between two bad options: keep identifying records (a breach risk and a trust barrier), or keep nothing (and lose the ability to verify anything, report to funders, or help participants prove their own progress).

## What Midnight ID does

Midnight ID is a credential layer where **the organization vouches once, and the math takes over**:

- **Enroll** — org staff issue a credential. Only a cryptographic commitment (a hash of a secret key) goes on-chain. The participant's alias never leaves the org's local device.
- **Check In** — the participant proves they hold an enrolled credential via a zero-knowledge Merkle membership proof. A daily nullifier prevents double check-ins without ever linking check-ins to each other or to an identity.
- **Verify** — a *different* organization can confirm "this person holds a valid credential" and learn nothing else. Not who they are, not where they enrolled, not when they attended.

The public ledger sees only: commitments, burned nullifiers, and counters. **No names. No identities. Only proofs, hashes, and counts.**

## Privacy properties

| Hidden (always) | Disclosed (public) |
|---|---|
| Participant identity | Enrollment count |
| Secret keys | Total check-in count |
| Which credential checked in | Commitment hashes |
| Check-in history per person | Daily nullifiers (unlinkable) |

- **Domain separation**: commitment and nullifier hashes use distinct domain prefixes, so values can never be confused or cross-correlated.
- **Daily nullifiers**: hash(sk, date) — the same person produces a different nullifier every day, so the ledger cannot link two check-ins to one credential.
- **Historic Merkle roots**: the tree accepts prior roots, so credentials stay valid as new participants enroll.

## Architecture

**Compact contract** (contract/src/bboard.compact) — 3 circuits, all compiled and tested:
- enroll(commitment) — inserts a credential commitment into a HistoricMerkleTree<10, Bytes<32>>
- checkIn(currentDate) — ZK membership proof + nullifier burn + counter increment
- verifyCredential() — pure membership proof for third-party verification
- publicCommitment(sk) — exported pure circuit so app and contract derive commitments identically

**Tests** (contract/src/test/) — 8/8 passing, with a success *and* failure case for every circuit: wrong-key check-ins rejected, same-day double check-ins rejected, strangers fail verification.

**Demo stack** — a Node demo server runs the compiled circuits through the contract simulator and plays the role of the org's local device (roster of aliases + keys) and the chain (the contract ledger). A React UI presents the three panels plus a live "What the chain sees" strip. This mirrors the intended production architecture: operational data stays in an org-controlled store appropriate for federal privacy compliance; **only the credential proof layer belongs on-chain**. That split is a design position, not a shortcut — sensitive service records should never live on a public ledger, even encrypted.

## Running it

    # 1. Compile the contract (requires compactc 0.31.0)
    cd contract && npm install && npm run compact && npm run build

    # 2. Run the tests
    npm run test

    # 3. Start the demo server (from repo root)
    cd .. && node demo-server.mjs

    # 4. Start the UI (second terminal)
    cd bboard-ui && npm install && npm run dev
    # open http://localhost:5173

## Honest trade-offs

- **Enrollment gating**: in this demo anyone can enroll. Production requires an admin-gated enroll (org keys), which is standard Compact practice but out of 48-hour scope.
- **Verification proves membership, not attendance**: verifyCredential proves "validly enrolled," deliberately *not* "attended N times" — per-credential attendance counts would require exactly the linkability this design forbids. Milestone credentials (prove >= N check-ins without revealing which) are the natural next circuit.
- **Demo runs circuits locally**, not against Preprod. The contract compiles with the standard toolchain and the provider plumbing for Preprod deployment is retained in api/ for the next milestone.

## Why this matters

I work as a Peer Lead at an opioid drop-in center serving roughly 15,000 contacts a year. The people who walk through our doors ask one question before any other: *"who's going to see this?"* Midnight ID is the first architecture I've found where the honest answer is: **no one — and I can prove it.**

Built with lived experience, at night. Because you ain't coding with Midnight unless you're coding at night. 🌙

## Author

**Andres F. Chavez** — Anonymous Haven LLC · El Paso, TX
GitHub: [@AC1706-67](https://github.com/AC1706-67)
EOFcd /mnt/c/Dev/midnight-id && cat > README.md << 'EOF'
# Midnight ID 🌙

**Portable anonymous credentials for community service organizations — built on Midnight.**

Built fresh during the MLH Midnight Hackathon (July 17–19, 2026).

## The problem

Community organizations — drop-in centers, peer recovery services, shelters, Naloxone distribution hubs — need to know that the person in front of them is enrolled, eligible, and showing up. But for the people they serve, being *on a list* can cost a job, housing, or custody. Federal privacy law (42 CFR Part 2) exists precisely because a substance-use service record is one of the most dangerous pieces of paper a person can have.

Today organizations choose between two bad options: keep identifying records (a breach risk and a trust barrier), or keep nothing (and lose the ability to verify anything, report to funders, or help participants prove their own progress).

## What Midnight ID does

Midnight ID is a credential layer where **the organization vouches once, and the math takes over**:

- **Enroll** — org staff issue a credential. Only a cryptographic commitment (a hash of a secret key) goes on-chain. The participant's alias never leaves the org's local device.
- **Check In** — the participant proves they hold an enrolled credential via a zero-knowledge Merkle membership proof. A daily nullifier prevents double check-ins without ever linking check-ins to each other or to an identity.
- **Verify** — a *different* organization can confirm "this person holds a valid credential" and learn nothing else. Not who they are, not where they enrolled, not when they attended.

The public ledger sees only: commitments, burned nullifiers, and counters. **No names. No identities. Only proofs, hashes, and counts.**

## Privacy properties

| Hidden (always) | Disclosed (public) |
|---|---|
| Participant identity | Enrollment count |
| Secret keys | Total check-in count |
| Which credential checked in | Commitment hashes |
| Check-in history per person | Daily nullifiers (unlinkable) |

- **Domain separation**: commitment and nullifier hashes use distinct domain prefixes, so values can never be confused or cross-correlated.
- **Daily nullifiers**: hash(sk, date) — the same person produces a different nullifier every day, so the ledger cannot link two check-ins to one credential.
- **Historic Merkle roots**: the tree accepts prior roots, so credentials stay valid as new participants enroll.

## Architecture

**Compact contract** (contract/src/bboard.compact) — 3 circuits, all compiled and tested:
- enroll(commitment) — inserts a credential commitment into a HistoricMerkleTree<10, Bytes<32>>
- checkIn(currentDate) — ZK membership proof + nullifier burn + counter increment
- verifyCredential() — pure membership proof for third-party verification
- publicCommitment(sk) — exported pure circuit so app and contract derive commitments identically

**Tests** (contract/src/test/) — 8/8 passing, with a success *and* failure case for every circuit: wrong-key check-ins rejected, same-day double check-ins rejected, strangers fail verification.

**Demo stack** — a Node demo server runs the compiled circuits through the contract simulator and plays the role of the org's local device (roster of aliases + keys) and the chain (the contract ledger). A React UI presents the three panels plus a live "What the chain sees" strip. This mirrors the intended production architecture: operational data stays in an org-controlled store appropriate for federal privacy compliance; **only the credential proof layer belongs on-chain**. That split is a design position, not a shortcut — sensitive service records should never live on a public ledger, even encrypted.

## Running it

    # 1. Compile the contract (requires compactc 0.31.0)
    cd contract && npm install && npm run compact && npm run build

    # 2. Run the tests
    npm run test

    # 3. Start the demo server (from repo root)
    cd .. && node demo-server.mjs

    # 4. Start the UI (second terminal)
    cd bboard-ui && npm install && npm run dev
    # open http://localhost:5173

## Honest trade-offs

- **Enrollment gating**: in this demo anyone can enroll. Production requires an admin-gated enroll (org keys), which is standard Compact practice but out of 48-hour scope.
- **Verification proves membership, not attendance**: verifyCredential proves "validly enrolled," deliberately *not* "attended N times" — per-credential attendance counts would require exactly the linkability this design forbids. Milestone credentials (prove >= N check-ins without revealing which) are the natural next circuit.
- **Demo runs circuits locally**, not against Preprod. The contract compiles with the standard toolchain and the provider plumbing for Preprod deployment is retained in api/ for the next milestone.

## Why this matters

I work as a Peer Lead at an opioid drop-in center serving roughly 15,000 contacts a year. The people who walk through our doors ask one question before any other: *"who's going to see this?"* Midnight ID is the first architecture I've found where the honest answer is: **no one — and I can prove it.**

Built with lived experience, at night. Because you ain't coding with Midnight unless you're coding at night. 🌙

## Author

**Andres F. Chavez** — Anonymous Haven LLC · El Paso, TX
GitHub: [@AC1706-67](https://github.com/AC1706-67)
