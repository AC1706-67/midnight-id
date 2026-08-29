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
    providers: IssuerProviders,
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
   * Enrolls a participant credential commitment into the Merkle tree.
   *
   * @param commitment The output of pureCircuits.publicCommitment(sk),
   * computed by the caller. The participant secret key is never passed
   * to this method and never enters issuer private state.
   */
  async enroll(commitment: Uint8Array): Promise<void> {
    this.logger?.info('enrollingCredential');
    const txData = await this.deployedContract.callTx.enroll(commitment);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'enroll',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }
}
