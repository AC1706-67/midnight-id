import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import {
  type Binding,
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  type Proof,
  type SignatureEnabled,
  Transaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export type ShieldedAddress = {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
};

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const matches = cleaned.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map((b) => parseInt(b, 16)));
}

export function createWalletProvidersFromConnectedAPI(
  connectedAPI: ConnectedAPI,
  shieldedAddress: ShieldedAddress,
): { walletProvider: WalletProvider; midnightProvider: MidnightProvider } {
  const walletProvider: WalletProvider = {
    getCoinPublicKey(): CoinPublicKey {
      return shieldedAddress.shieldedCoinPublicKey as CoinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      return shieldedAddress.shieldedEncryptionPublicKey as EncPublicKey;
    },
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const serializedStr = uint8ArrayToHex(tx.serialize());
      const result = await connectedAPI.balanceUnsealedTransaction(serializedStr);
      const resultBytes = hexToUint8Array(result.tx);
      const deserialized = Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        resultBytes,
      ) as Transaction<SignatureEnabled, Proof, Binding>;
      return deserialized as unknown as FinalizedTransaction;
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      await connectedAPI.submitTransaction(uint8ArrayToHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };

  return { walletProvider, midnightProvider };
}
