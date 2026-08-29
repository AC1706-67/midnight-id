// SPDX-License-Identifier: Apache-2.0

/**
 * Participant role API.
 *
 * Joins an existing credential contract and proves membership. The
 * participant secret key arrives from a card scan, lives in an in-memory
 * private state for the duration of one proof, and is cleared afterwards.
 * It is never written to disk and never logged (42 CFR Part 2).
 *
 * The Merkle path is resolved fresh from current ledger state before each
 * proof via findPathForLeaf(commitment). Leaf index is not tracked;
 * HistoricMerkleTree.checkRoot accepts prior roots, so a freshly fetched
 * path is always valid.
 *
 * @module
 */

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import * as Mano from '../../contract/src/managed/bboard/contract/index.js';
import { ParticipantCompiledContract } from './compiled.js';
import { createParticipantPrivateState, type CredentialMerklePath } from './types.js';
import { participantPrivateStateKey, type ParticipantProviders, type ParticipantContract, type DeployedParticipantContract } from './common-types.js';

export class ManoParticipantAPI {
  private constructor(
    public readonly deployedContract: DeployedParticipantContract,
    private readonly providers: ParticipantProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
  }

  readonly deployedContractAddress: ContractAddress;

  /**
   * Joins an already deployed credential contract.
   *
   * @param secretKey The participant secret key, read from the card. Held
   * in memory only; providers.privateStateProvider must be an
   * EphemeralPrivateStateProvider.
   */
  static async join(providers: ParticipantProviders, contractAddress: ContractAddress, secretKey: Uint8Array, logger?: Logger): Promise<ManoParticipantAPI> {
    logger?.info({ joinContract: { contractAddress } });
    providers.privateStateProvider.setContractAddress(contractAddress);
    const found = await findDeployedContract<ParticipantContract>(providers, {
      contractAddress,
      compiledContract: ParticipantCompiledContract,
      privateStateId: participantPrivateStateKey,
      initialPrivateState: createParticipantPrivateState(secretKey),
    });
    return new ManoParticipantAPI(found, providers, logger);
  }

  /**
   * Fetches the current Merkle path for this participant's commitment and
   * writes it into private state so the credentialPath witness can read it.
   */
  private async refreshPath(): Promise<void> {
    const existing = await this.providers.privateStateProvider.get(participantPrivateStateKey);
    if (existing === null) {
      throw new Error('no participant private state - join() must be called first');
    }
    const commitment = Mano.pureCircuits.publicCommitment(existing.secretKey);
    const contractState = await this.providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    if (contractState === null) {
      throw new Error('contract state unavailable from indexer');
    }
    const path = Mano.ledger(contractState.data).credentialTree.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error('credential not found in tree - card is not enrolled');
    }
    await this.providers.privateStateProvider.set(participantPrivateStateKey, createParticipantPrivateState(existing.secretKey, path as CredentialMerklePath));
  }

  /**
   * Proves enrollment and records a check-in for the given date.
   *
   * @param currentDate Date encoding, prover-supplied. The nullifier is
   * derived from (sk, currentDate), so a dishonest prover can produce more
   * than one nullifier per real day. Documented, not hidden.
   */
  async checkIn(currentDate: Uint8Array): Promise<void> {
    this.logger?.info('checkingIn');
    await this.refreshPath();
    const txData = await this.deployedContract.callTx.checkIn(currentDate);
    this.logger?.trace({ transactionAdded: { circuit: 'checkIn', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight } });
  }

  /**
   * Proves the participant holds a valid enrolled credential, without
   * revealing which one. Used by a verifier at the point of service.
   *
   * Same secret handling as checkIn: path fetched fresh from current
   * ledger state. The session secret is dropped by close(), not here.
   */
  async verifyCredential(): Promise<void> {
    this.logger?.info('verifyingCredential');
    await this.refreshPath();
    const txData = await this.deployedContract.callTx.verifyCredential();
    this.logger?.trace({ transactionAdded: { circuit: 'verifyCredential', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight } });
  }

  /**
   * Ends the participant session and discards the secret key.
   *
   * The card secret is held in memory for the duration of a session - a
   * participant at the kiosk may check in and then prove a credential -
   * and is dropped when they walk away. It never reaches disk regardless,
   * because the provider is in-memory only.
   */
  async close(): Promise<void> {
    await this.providers.privateStateProvider.clear();
    this.logger?.info('participant session closed');
  }
}
