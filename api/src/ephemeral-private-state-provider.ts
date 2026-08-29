// SPDX-License-Identifier: Apache-2.0

/**
 * In-memory PrivateStateProvider for the participant role.
 *
 * The participant secret key arrives from a card scan, is used to prove
 * one circuit, and is discarded. It must never reach disk: a kiosk tablet
 * accumulating participant secrets in LevelDB would be a 42 CFR Part 2
 * exposure and would defeat the point of the credential.
 *
 * This provider makes that structural rather than a matter of discipline -
 * there is no code path here that writes anything to persistent storage.
 * Call clear() in a finally block after every proof.
 *
 * @module
 */

import type { PrivateStateProvider, PrivateStateId, PrivateStateExport, ExportPrivateStatesOptions, ImportPrivateStatesOptions, ImportPrivateStatesResult, SigningKeyExport, ExportSigningKeysOptions, ImportSigningKeysOptions, ImportSigningKeysResult } from '@midnight-ntwrk/midnight-js-types';
import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

export class EphemeralPrivateStateProvider<PSI extends PrivateStateId = PrivateStateId, PS = any> implements PrivateStateProvider<PSI, PS> {
  private contractAddress: ContractAddress | null = null;
  private readonly states = new Map<string, PS>();
  private readonly signingKeys = new Map<string, SigningKey>();

  setContractAddress(address: ContractAddress): void {
    this.contractAddress = address;
  }

  private scoped(privateStateId: PSI): string {
    if (this.contractAddress === null) {
      throw new Error('setContractAddress must be called before private state access');
    }
    return `${String(this.contractAddress)}:${String(privateStateId)}`;
  }

  async set(privateStateId: PSI, state: PS): Promise<void> {
    this.states.set(this.scoped(privateStateId), state);
  }

  async get(privateStateId: PSI): Promise<PS | null> {
    return this.states.get(this.scoped(privateStateId)) ?? null;
  }

  async remove(privateStateId: PSI): Promise<void> {
    this.states.delete(this.scoped(privateStateId));
  }

  async clear(): Promise<void> {
    this.states.clear();
    this.signingKeys.clear();
  }

  async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
    this.signingKeys.set(String(address), signingKey);
  }

  async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
    return this.signingKeys.get(String(address)) ?? null;
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    this.signingKeys.delete(String(address));
  }

  async clearSigningKeys(): Promise<void> {
    this.signingKeys.clear();
  }

  // Export/import are unsupported by design: this provider exists so that
  // participant secrets cannot be serialized out of memory.
  async exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
    throw new Error('ephemeral private state cannot be exported');
  }

  async importPrivateStates(_exportData: PrivateStateExport, _options?: ImportPrivateStatesOptions): Promise<ImportPrivateStatesResult> {
    throw new Error('ephemeral private state cannot be imported');
  }

  async exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
    throw new Error('ephemeral signing keys cannot be exported');
  }

  async importSigningKeys(_exportData: SigningKeyExport, _options?: ImportSigningKeysOptions): Promise<ImportSigningKeysResult> {
    throw new Error('ephemeral signing keys cannot be imported');
  }
}
