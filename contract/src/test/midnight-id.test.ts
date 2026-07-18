/**
 * Midnight ID - contract tests.
 * Success AND failure case for every circuit.
 */

import { describe, expect, it } from "vitest";
import { persistentHash } from "@midnight-ntwrk/compact-runtime";
import { MidnightIdSimulator } from "./midnight-id-simulator.js";

// --- helpers ---------------------------------------------------------

const textBytes32 = (s: string): Uint8Array => {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(s);
  out.set(enc.slice(0, 32));
  return out;
};

const COMMITMENT_DOMAIN = textBytes32("midnight-id:commitment");

// Compute the commitment exactly as the circuit does:
// persistentHash([pad(32,"midnight-id:commitment"), sk])
const commitmentFor = (sk: Uint8Array): Uint8Array =>
  persistentHash(
    { tag: "bytes[32]", length: 2 } as never,
    [COMMITMENT_DOMAIN, sk] as never,
  ) as unknown as Uint8Array;

const DAY_1 = textBytes32("2026-07-17");
const DAY_2 = textBytes32("2026-07-18");

const aliceSk = textBytes32("alice-secret-key");
const bobSk = textBytes32("bob-secret-key");
const strangerSk = textBytes32("stranger-secret-key");

// --- tests -----------------------------------------------------------

describe("Midnight ID", () => {
  it("enrolls a credential and increments enrollment count", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const ledger = sim.enroll(commitmentFor(aliceSk));
    expect(ledger.enrollmentCount).toEqual(1n);
  });

  it("checks in with a valid enrolled credential", () => {
    const sim = new MidnightIdSimulator(aliceSk);
    const commitment = commitmentFor(aliceSk);
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
    const commitment = commitmentFor(aliceSk);
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
    const commitment = commitmentFor(aliceSk);
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
    const commitment = commitmentFor(aliceSk);
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
    const aliceCommitment = commitmentFor(aliceSk);
    const bobCommitment = commitmentFor(bobSk);

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
    const commitment = commitmentFor(aliceSk);
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
    const commitment = commitmentFor(aliceSk);
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
