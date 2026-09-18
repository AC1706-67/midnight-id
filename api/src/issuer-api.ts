// SPDX-License-Identifier: Apache-2.0

/**
 * Issuer role API.
 *
 * Deploys the credential contract and enrolls participants. Holds the
 * issuer secret key in persistent private state. Never holds, receives,
 * or logs a participant secret key: the caller derives the commitment
 * locally via publicCommitment(sk) and passes only the commitment here.
 *
 * @module
 */

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, type Observable } from 'rxjs';
import * as Mano from '../../contract/src/managed/bboard/contract/index.js';
import { IssuerCompiledContract } from './compiled.js';
import { createIssuerPrivateState, type IssuerPrivateState } from './types.js';
import { issuerPrivateStateKey, deriveManoPublicState, type IssuerProviders, type IssuerContract, type DeployedIssuerContract, type ManoPublicState } from './common-types.js';
import * as utils from './utils/index.js';

export class ManoIssuerAPI {
  private constructor(
    public readonly deployedContract: DeployedIssuerContract,
    private readonly providers: IssuerProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest([
      providers.publicDataProvider
        .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
        .pipe(map((contractState) => Mano.ledger(contractState.data))),
    ]).pipe(map(([ledgerState]) => deriveManoPublicState(ledgerState)));
  }

  readonly deployedContractAddress: ContractAddress;

  readonly state$: Observable<ManoPublicState>;

  /**
   * Reads the current attestation epoch from the indexer.
   *
   * Commitments are epoch-scoped, so any caller deriving one off-chain must
   * pin it to this value. Read it immediately before enrolling: a card issued
   * against a stale epoch will never validate at check-in.
   */
  async currentEpoch(): Promise<bigint> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (contractState === null) {
      throw new Error('contract state unavailable from indexer');
    }
    return Mano.ledger(contractState.data).currentEpoch;
  }

  /**
   * Closes the current attestation window and opens the next one.
   *
   * DESTRUCTIVE: every credential issued in the prior epoch stops validating
   * immediately. Participants must present their card in person to re-attest,
   * because only they hold the secret their new commitment is derived from.
   * There is no undo - the counter only moves forward.
   */
  async advanceEpoch(): Promise<string> {
    this.logger?.info('advancingAttestationEpoch');
    const txData = await this.deployedContract.callTx.advanceEpoch();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'advanceEpoch',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
    return txData.public.txHash;
  }

  /**
   * Enrolls a participant credential commitment into the Merkle tree.
   *
   * @param commitment The output of pureCircuits.publicCommitment(sk),
   * computed by the caller. The participant secret key is never passed
   * to this method and never enters issuer private state.
   */
  async enroll(commitment: Uint8Array): Promise<string> {
    this.logger?.info('enrollingCredential');
    const txData = await this.deployedContract.callTx.enroll(commitment);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'enroll',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
    return txData.public.txHash;
  }

  /**
   * Deploys a new credential contract. The issuer public key is pinned in
   * the constructor from the issuer secret key, so only the holder of that
   * key can enroll against this deployment.
   */
  static async deploy(providers: IssuerProviders, issuerSecretKey: Uint8Array, logger?: Logger): Promise<ManoIssuerAPI> {
    logger?.info('deployContract');
    const issuerPk = Mano.pureCircuits.publicIssuerPk(issuerSecretKey);
    const deployed = await deployContract(providers, {
      compiledContract: IssuerCompiledContract,
      privateStateId: issuerPrivateStateKey,
      initialPrivateState: createIssuerPrivateState(issuerSecretKey),
      args: [issuerPk],
    });
    logger?.trace({ contractDeployed: { finalizedDeployTxData: deployed.deployTxData.public } });
    return new ManoIssuerAPI(deployed, providers, logger);
  }

  /** Joins an already deployed credential contract as the issuer. */
  static async join(providers: IssuerProviders, contractAddress: ContractAddress, issuerSecretKey: Uint8Array, logger?: Logger): Promise<ManoIssuerAPI> {
    logger?.info({ joinContract: { contractAddress } });
    providers.privateStateProvider.setContractAddress(contractAddress);
    const found = await findDeployedContract<IssuerContract>(providers, {
      contractAddress,
      compiledContract: IssuerCompiledContract,
      privateStateId: issuerPrivateStateKey,
      initialPrivateState: createIssuerPrivateState(issuerSecretKey),
    });
    logger?.trace({ contractJoined: { finalizedDeployTxData: found.deployTxData.public } });
    return new ManoIssuerAPI(found, providers, logger);
  }
}
