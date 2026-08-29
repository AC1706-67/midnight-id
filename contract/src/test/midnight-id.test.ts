/**
 * Midnight ID - contract tests.
 * Success AND failure case for every circuit.
 */

import { describe, expect, it } from "vitest";
import { MidnightIdSimulator } from "./midnight-id-simulator.js";

// --- helpers ---------------------------------------------------------

const textBytes32 = (s: string): Uint8Array => {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(s);
  out.set(enc.slice(0, 32));
  return out;
};

const DAY_1 = textBytes32("2026-07-17");
const DAY_2 = textBytes32("2026-07-18");

const aliceSk = textBytes32("alice-secret-key");
const bobSk = textBytes32("bob-secret-key");
const strangerSk = textBytes32("stranger-secret-key");

// --- tests -----------------------------------------------------------

describe("Midnight ID", () => {
  it("enrolls a credential and increments enrollment count", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const ledger = sim.enroll(sim.commitmentFor(aliceSk));
    expect(ledger.enrollmentCount).toEqual(1n);
  });

  it("checks in with a valid enrolled credential", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = sim.commitmentFor(aliceSk);
    sim.enroll(commitment);

    const path = sim.pathFor(0n, commitment);
    sim.switchUser({
      secretKey: aliceSk,
      leafIndex: 0n,
      currentPath: path,
    });

    const ledger = sim.checkIn(DAY_1);
    expect(ledger.totalCheckIns).toEqual(1n);
  });

  it("rejects check-in with a wrong secret key", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = sim.commitmentFor(aliceSk);
    sim.enroll(commitment);

    const path = sim.pathFor(0n, commitment);
    sim.switchUser({
      secretKey: strangerSk, // wrong key, real path
      leafIndex: 0n,
      currentPath: path,
    });

    expect(() => sim.checkIn(DAY_1)).toThrow();
  });

  it("rejects double check-in on the same day (nullifier)", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = sim.commitmentFor(aliceSk);
    sim.enroll(commitment);

    const path = sim.pathFor(0n, commitment);
    sim.switchUser({
      secretKey: aliceSk,
      leafIndex: 0n,
      currentPath: path,
    });

    sim.checkIn(DAY_1);
    expect(() => sim.checkIn(DAY_1)).toThrow();
  });

  it("allows check-in on a new day (nullifier is per-date)", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = sim.commitmentFor(aliceSk);
    sim.enroll(commitment);

    const path = sim.pathFor(0n, commitment);
    sim.switchUser({
      secretKey: aliceSk,
      leafIndex: 0n,
      currentPath: path,
    });

    sim.checkIn(DAY_1);
    const ledger = sim.checkIn(DAY_2);
    expect(ledger.totalCheckIns).toEqual(2n);
  });

  it("supports multiple enrolled credentials independently", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const aliceCommitment = sim.commitmentFor(aliceSk);
    const bobCommitment = sim.commitmentFor(bobSk);

    sim.enroll(aliceCommitment);
    sim.enroll(bobCommitment);

    const bobPath = sim.pathFor(1n, bobCommitment);
    sim.switchUser({
      secretKey: bobSk,
      leafIndex: 1n,
      currentPath: bobPath,
    });

    const ledger = sim.checkIn(DAY_1);
    expect(ledger.totalCheckIns).toEqual(1n);
    expect(ledger.enrollmentCount).toEqual(2n);
  });

  it("verifies an enrolled credential without revealing it", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = sim.commitmentFor(aliceSk);
    sim.enroll(commitment);

    const path = sim.pathFor(0n, commitment);
    sim.switchUser({
      secretKey: aliceSk,
      leafIndex: 0n,
      currentPath: path,
    });

    expect(() => sim.verifyCredential()).not.toThrow();
  });

  it("rejects credential verification for a stranger", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = sim.commitmentFor(aliceSk);
    sim.enroll(commitment);

    const path = sim.pathFor(0n, commitment);
    sim.switchUser({
      secretKey: strangerSk,
      leafIndex: 0n,
      currentPath: path,
    });

    expect(() => sim.verifyCredential()).toThrow();
  });
});

/**
 * KNOWN VULNERABILITY - `enroll` is unauthenticated.
 *
 * This block documents a defect that is still present in the contract. It
 * asserts the BROKEN behaviour on purpose, so it PASSES while the hole is
 * open and FAILS the moment `enroll` gains an authorization check.
 *
 * A failure here is good news: it means enroll is now authorized. When that
 * happens, replace these assertions with their inverse (the stranger's
 * `enroll` call should throw) rather than deleting the coverage.
 *
 * Tracked as Known repo issue 3 in CLAUDE.md.
 */
describe("KNOWN VULNERABILITY: unauthenticated enroll", () => {
  it("VULN (expected to pass until fixed): a stranger can self-enroll and then check in with the self-issued credential", () => {
    // The org legitimately enrolls a participant. Leaf 0 is honest.
    const sim = new MidnightIdSimulator(aliceSk);
    sim.enroll(sim.commitmentFor(aliceSk));

    // A stranger picks their own secret and derives the matching commitment.
    // `publicCommitment` is a pure circuit, so this needs nothing from the org
    // - no issuer key, no enrollment session, no staff involvement.
    const strangerCommitment = sim.commitmentFor(strangerSk);

    // The hole: enroll takes only a commitment and checks nothing about the
    // caller, so the stranger writes their own leaf straight into the tree.
    expect(() => sim.enroll(strangerCommitment)).not.toThrow();

    const ledgerAfterEnroll = sim.getLedger();
    expect(ledgerAfterEnroll.enrollmentCount).toEqual(2n);

    // The self-issued credential is now indistinguishable from a real one:
    // it sits in credentialTree and produces a valid Merkle path.
    const strangerPath = sim.pathFor(1n, strangerCommitment);
    sim.switchUser({
      secretKey: strangerSk,
      leafIndex: 1n,
      currentPath: strangerPath,
    });

    // And it checks in successfully, burning a nullifier and inflating the
    // service's check-in count.
    const ledger = sim.checkIn(DAY_1);
    expect(ledger.totalCheckIns).toEqual(1n);

    // verifyCredential accepts it too - a third party would be told this
    // stranger holds a valid credential.
    expect(() => sim.verifyCredential()).not.toThrow();
  });
});
