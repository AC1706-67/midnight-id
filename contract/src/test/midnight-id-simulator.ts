/**
 * Midnight ID - test simulator.
 *
 * Exercises the contract in a local sandbox: enroll credentials,
 * check in with a daily nullifier, verify credentials as a third party.
 *
 * The simulator starts out holding the issuer secret key, i.e. it models
 * the issuing organization's own device. `switchUser` models handing the
 * session to somebody else and therefore drops the issuer key by default.
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
  pureCircuits,
} from "../managed/bboard/contract/index.js";
import {
  type MidnightIdPrivateState,
  type CredentialMerklePath,
  witnesses,
} from "../witnesses.js";

// Default issuer identity for tests that do not care which key issues.
const DEFAULT_ISSUER_SK = new Uint8Array(32).fill(7);

export class MidnightIdSimulator {
  readonly contract: Contract<MidnightIdPrivateState>;
  readonly issuerPk: Uint8Array;
  circuitContext: CircuitContext<MidnightIdPrivateState>;

  constructor(
    secretKey: Uint8Array,
    issuerSecretKey: Uint8Array = DEFAULT_ISSUER_SK,
  ) {
    this.contract = new Contract<MidnightIdPrivateState>(witnesses);
    // Derived with the contract's own pure circuit, so it matches what
    // enroll recomputes from issuerSk() at call time.
    this.issuerPk = pureCircuits.publicIssuerPk(issuerSecretKey);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(
        {
          secretKey,
          leafIndex: null,
          currentPath: null,
          issuerSecretKey,
        },
        "0".repeat(64),
      ),
      this.issuerPk,
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

  // Become a different actor. `issuerSecretKey` defaults to null: an
  // arbitrary person does not hold the org's issuing key, so enroll will
  // fail for them. Pass it explicitly to model the org itself.
  public switchUser(privateState: {
    secretKey: Uint8Array;
    leafIndex: bigint | null;
    currentPath: CredentialMerklePath | null;
    issuerSecretKey?: Uint8Array | null;
  }) {
    this.circuitContext.currentPrivateState = {
      secretKey: privateState.secretKey,
      leafIndex: privateState.leafIndex,
      currentPath: privateState.currentPath,
      issuerSecretKey: privateState.issuerSecretKey ?? null,
    };
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

  // Same, for the daily nullifier that checkIn burns.
  public nullifierFor(secretKey: Uint8Array, date: Uint8Array): Uint8Array {
    return this.contract.circuits.publicNullifier(
      this.circuitContext,
      secretKey,
      date,
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
