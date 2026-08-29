/**
 * Midnight ID - private state and witness functions.
 *
 * The contract declares three witnesses:
 *   localSecretKey(): Bytes<32>
 *   credentialPath(): MerkleTreePath<10, Bytes<32>>
 *   issuerSk(): Bytes<32>
 *
 * The secret key never leaves this machine. The Merkle path is
 * fetched fresh from the indexer before each check-in (leaf index
 * is fixed at enrollment; HistoricMerkleTree.checkRoot accepts
 * prior roots, so a freshly fetched path is always valid).
 *
 * The issuer secret key is held ONLY by the issuing organization.
 * A participant install leaves it null, which makes `enroll`
 * unusable there - it fails locally before a proof is ever attempted.
 */

import { Ledger } from "./managed/bboard/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type CredentialMerklePath = {
  leaf: Uint8Array;
  path: { sibling: { field: bigint }; goes_left: boolean }[];
};

export type MidnightIdPrivateState = {
  readonly secretKey: Uint8Array;
  readonly leafIndex: bigint | null;
  readonly currentPath: CredentialMerklePath | null;
  readonly issuerSecretKey: Uint8Array | null;
};

export const createMidnightIdPrivateState = (
  secretKey: Uint8Array,
  leafIndex: bigint | null = null,
  currentPath: CredentialMerklePath | null = null,
  issuerSecretKey: Uint8Array | null = null,
): MidnightIdPrivateState => ({
  secretKey,
  leafIndex,
  currentPath,
  issuerSecretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, MidnightIdPrivateState>): [
    MidnightIdPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],

  credentialPath: ({
    privateState,
  }: WitnessContext<Ledger, MidnightIdPrivateState>): [
    MidnightIdPrivateState,
    CredentialMerklePath,
  ] => {
    if (privateState.currentPath === null) {
      throw new Error(
        "No Merkle path in private state - fetch path from indexer before proving",
      );
    }
    return [privateState, privateState.currentPath];
  },

  issuerSk: ({
    privateState,
  }: WitnessContext<Ledger, MidnightIdPrivateState>): [
    MidnightIdPrivateState,
    Uint8Array,
  ] => {
    if (privateState.issuerSecretKey === null) {
      throw new Error(
        "No issuer secret key in private state - only the issuing organization can enroll credentials",
      );
    }
    return [privateState, privateState.issuerSecretKey];
  },
};
