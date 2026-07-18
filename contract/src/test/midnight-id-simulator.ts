/**
 * Midnight ID - test simulator.
 *
 * Exercises the contract in a local sandbox: enroll credentials,
 * check in with a daily nullifier, verify credentials as a third party.
 */

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/bboard/contract/index.js";
import {
  type MidnightIdPrivateState,
  type CredentialMerklePath,
  witnesses,
} from "../witnesses.js";

export class MidnightIdSimulator {
  readonly contract: Contract<MidnightIdPrivateState>;
  circuitContext: CircuitContext<MidnightIdPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<MidnightIdPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(
        { secretKey, leafIndex: null, currentPath: null },
        "0".repeat(64),
      ),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  public switchUser(privateState: MidnightIdPrivateState) {
    this.circuitContext.currentPrivateState = privateState;
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): MidnightIdPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  // Compute a commitment using the contract's own pure circuit -
  // guaranteed to match what checkIn/verifyCredential expect.
  public commitmentFor(secretKey: Uint8Array): Uint8Array {
    return this.contract.circuits.publicCommitment(
      this.circuitContext,
      secretKey,
    ).result;
  }

  public enroll(commitment: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.enroll(
      this.circuitContext,
      commitment,
    ).context;
    return this.getLedger();
  }

  // Build a Merkle path for an enrolled leaf from the simulated tree.
  public pathFor(leafIndex: bigint, leaf: Uint8Array): CredentialMerklePath {
    return this.getLedger().credentialTree.pathForLeaf(
      leafIndex,
      leaf,
    ) as CredentialMerklePath;
  }

  public checkIn(currentDate: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.checkIn(
      this.circuitContext,
      currentDate,
    ).context;
    return this.getLedger();
  }

  public verifyCredential(): Ledger {
    this.circuitContext = this.contract.impureCircuits.verifyCredential(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }
}
