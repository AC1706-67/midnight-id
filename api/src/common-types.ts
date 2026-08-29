// SPDX-License-Identifier: Apache-2.0

/**
 * Common types for the MANO credential API.
 *
 * Three roles, three shapes:
 *   Issuer      - persistent private state (issuer key), enrolls credentials
 *   Participant - ephemeral private state (participant key), checks in / proves
 *   Verifier    - NO private state, read-only ledger observation
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { Contract, Witnesses, Ledger } from '../../contract/src/index';
import type { IssuerPrivateState, ParticipantPrivateState } from './types.js';

/** Private state store keys. Separate keys keep the two states in separate stores. */
export const issuerPrivateStateKey = 'manoIssuerPrivateState';
export const participantPrivateStateKey = 'manoParticipantPrivateState';

export type IssuerPrivateStateId = typeof issuerPrivateStateKey;
export type ParticipantPrivateStateId = typeof participantPrivateStateKey;

export type IssuerPrivateStates = {
  readonly manoIssuerPrivateState: IssuerPrivateState;
};

export type ParticipantPrivateStates = {
  readonly manoParticipantPrivateState: ParticipantPrivateState;
};

/** Contract instantiated per role. */
export type IssuerContract = Contract<IssuerPrivateState, Witnesses<IssuerPrivateState>>;
export type ParticipantContract = Contract<ParticipantPrivateState, Witnesses<ParticipantPrivateState>>;

/**
 * Circuit keys narrowed per role.
 * Enforced at the type level so an issuer build cannot call checkIn
 * and a participant build cannot call enroll.
 */
export type IssuerCircuitKeys = 'enroll';
export type ParticipantCircuitKeys = 'checkIn' | 'verifyCredential';

export type IssuerProviders = MidnightProviders<
  IssuerCircuitKeys,
  IssuerPrivateStateId,
  IssuerPrivateState
>;

export type ParticipantProviders = MidnightProviders<
  ParticipantCircuitKeys,
  ParticipantPrivateStateId,
  ParticipantPrivateState
>;

export type DeployedIssuerContract = FoundContract<IssuerContract>;
export type DeployedParticipantContract = FoundContract<ParticipantContract>;

/**
 * Public ledger state, derived.
 *
 * Contains ONLY on-chain public values. No participant-derived data
 * appears here - this shape is what the verifier role reads, and it
 * must never carry anything that could identify a participant.
 */
export type ManoPublicState = {
  readonly enrollmentCount: bigint;
  readonly totalCheckIns: bigint;
  readonly nullifierCount: bigint;
  readonly issuerPk: Uint8Array;
  readonly treeIsFull: boolean;
};

export const deriveManoPublicState = (ledger: Ledger): ManoPublicState => ({
  enrollmentCount: ledger.enrollmentCount,
  totalCheckIns: ledger.totalCheckIns,
  nullifierCount: ledger.usedNullifiers.size(),
  issuerPk: ledger.issuerPk,
  treeIsFull: ledger.credentialTree.isFull(),
});
