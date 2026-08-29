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
const forgedIssuerSk = textBytes32("forged-issuer-key");

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
 * REGRESSION - `enroll` is authorized.
 *
 * `enroll` used to take only a commitment and check nothing whatsoever about
 * the caller, so anyone could write their own leaf into `credentialTree` and
 * self-issue a credential that then passed `checkIn` and `verifyCredential`.
 *
 * It now asserts that the caller can produce the preimage of the sealed
 * `issuerPk` fixed at deployment, proven in-circuit rather than trusted from
 * the prover. These tests assert the FIXED behaviour: a caller who does not
 * hold the issuer secret key cannot enroll, and a rejected enroll leaves the
 * tree untouched, so no self-issued credential ever exists to check in with.
 *
 * A failure here means enroll has lost its authorization check.
 *
 * Tracked under Fixed in CLAUDE.md.
 */
describe("regression: enroll is authorized", () => {
  it("rejects enroll from a caller holding no issuer secret key", () => {
    // The org legitimately enrolls a participant. Leaf 0 is honest.
    const sim = new MidnightIdSimulator(aliceSk);
    sim.enroll(sim.commitmentFor(aliceSk));

    // A stranger picks their own secret and derives the matching commitment.
    // `publicCommitment` is a pure circuit, so this still needs nothing from
    // the org - that part was never the defence.
    const strangerCommitment = sim.commitmentFor(strangerSk);

    // The stranger takes over the session BEFORE enrolling: they hold their
    // own credential secret, but not the org's issuing key. `switchUser`
    // drops `issuerSecretKey` unless it is passed explicitly.
    sim.switchUser({
      secretKey: strangerSk,
      leafIndex: null,
      currentPath: null,
    });

    expect(() => sim.enroll(strangerCommitment)).toThrow();

    // The tree is untouched - the stranger's leaf never landed.
    expect(sim.getLedger().enrollmentCount).toEqual(1n);
    expect(
      sim.getLedger().credentialTree.findPathForLeaf(strangerCommitment),
    ).toBeUndefined();
  });

  it("rejects enroll from a caller holding the wrong issuer secret key", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    sim.enroll(sim.commitmentFor(aliceSk));

    const strangerCommitment = sim.commitmentFor(strangerSk);

    // Supplying *some* issuer key gets past the witness and reaches the
    // in-circuit assert, which is where the real check lives.
    sim.switchUser({
      secretKey: strangerSk,
      leafIndex: null,
      currentPath: null,
      issuerSecretKey: forgedIssuerSk,
    });

    expect(() => sim.enroll(strangerCommitment)).toThrow(/not the issuer/);

    expect(sim.getLedger().enrollmentCount).toEqual(1n);
    expect(
      sim.getLedger().credentialTree.findPathForLeaf(strangerCommitment),
    ).toBeUndefined();
  });

  it("still lets the issuing organization enroll", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    sim.enroll(sim.commitmentFor(aliceSk));
    sim.enroll(sim.commitmentFor(bobSk));
    expect(sim.getLedger().enrollmentCount).toEqual(2n);
  });
});
