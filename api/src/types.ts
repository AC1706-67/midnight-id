// SPDX-License-Identifier: Apache-2.0

import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { Ledger, Witnesses } from "@midnight-ntwrk/bboard-contract";

/**
 * Merkle path shape as the contract's credentialPath witness expects it.
 * Structurally matches MerkleTreePath<Uint8Array> returned by
 * ledger.credentialTree.findPathForLeaf(commitment).
 */
export type CredentialMerklePath = {
  leaf: Uint8Array;
  path: { sibling: { field: bigint }; goes_left: boolean }[];
};

/**
 * ISSUER private state. Persistent (LevelDB), one per device.
 * Holds only the issuing key. Never holds a participant secret.
 */
export type IssuerPrivateState = {
  readonly issuerSecretKey: Uint8Array;
};

export const createIssuerPrivateState = (
  issuerSecretKey: Uint8Array,
): IssuerPrivateState => ({ issuerSecretKey });

/**
 * PARTICIPANT private state. Ephemeral, in-memory only.
 * Lifetime is a single circuit call: populate from card scan,
 * prove, clear. Never written to disk (42 CFR Part 2).
 */
export type ParticipantPrivateState = {
  readonly secretKey: Uint8Array;
  readonly currentPath: CredentialMerklePath | null;
};

export const createParticipantPrivateState = (
  secretKey: Uint8Array,
  currentPath: CredentialMerklePath | null = null,
): ParticipantPrivateState => ({ secretKey, currentPath });

const wrongRole = (witness: string, role: string): never => {
  throw new Error(
    `${witness}() invoked in ${role} context - this witness is not available to this role`,
  );
};

/** Issuer witnesses: issuerSk only. Participant witnesses throw. */
export const issuerWitnesses: Witnesses<IssuerPrivateState> = {
  issuerSk: ({
    privateState,
  }: WitnessContext<Ledger, IssuerPrivateState>): [
    IssuerPrivateState,
    Uint8Array,
  ] => [privateState, privateState.issuerSecretKey],

  localSecretKey: () => wrongRole("localSecretKey", "issuer"),
  credentialPath: () => wrongRole("credentialPath", "issuer"),
};

/** Participant witnesses: localSecretKey + credentialPath. issuerSk throws. */
export const participantWitnesses: Witnesses<ParticipantPrivateState> = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, ParticipantPrivateState>): [
    ParticipantPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],

  credentialPath: ({
    privateState,
  }: WitnessContext<Ledger, ParticipantPrivateState>): [
    ParticipantPrivateState,
    CredentialMerklePath,
  ] => {
    if (privateState.currentPath === null) {
      throw new Error(
        "No Merkle path in private state - fetch via findPathForLeaf(commitment) before proving",
      );
    }
    return [privateState, privateState.currentPath];
  },

  issuerSk: () => wrongRole("issuerSk", "participant"),
};
