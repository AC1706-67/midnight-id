/**
 * Midnight ID - private state and witness functions.
 *
 * The contract declares two witnesses:
 *   localSecretKey(): Bytes<32>
 *   credentialPath(): MerkleTreePath<10, Bytes<32>>
 *
 * The secret key never leaves this machine. The Merkle path is
 * fetched fresh from the indexer before each check-in (leaf index
 * is fixed at enrollment; HistoricMerkleTree.checkRoot accepts
 * prior roots, so a freshly fetched path is always valid).
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
};

export const createMidnightIdPrivateState = (
  secretKey: Uint8Array,
  leafIndex: bigint | null = null,
  currentPath: CredentialMerklePath | null = null,
): MidnightIdPrivateState => ({
  secretKey,
  leafIndex,
  currentPath,
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
};
