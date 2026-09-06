import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { createWalletProvidersFromConnectedAPI, type ShieldedAddress } from './walletAdapter';

export type MidnightIdCircuits = 'enroll' | 'checkIn' | 'verifyCredential';

export async function buildBrowserProviders(
  connectedAPI: ConnectedAPI,
  contractName: string,
) {
  const zkConfigHttpBase = window.location.origin + '/contract/compiled/' + contractName;
  const zkConfigProvider = new FetchZkConfigProvider<MidnightIdCircuits>(
    zkConfigHttpBase,
    fetch.bind(window),
  );

  const config = await connectedAPI.getConfiguration();
  const rawPublicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);

  const publicDataProvider = {
    ...rawPublicDataProvider,
    async queryZSwapAndContractState(contractAddress: any, queryConfig?: any) {
      const result = await rawPublicDataProvider.queryZSwapAndContractState(
        contractAddress,
        queryConfig,
      );
      if (!result) return result;
      const [zswapChainState, contractState, ledgerParameters] = result;
      return [
        zswapChainState.postBlockUpdate(new Date()),
        contractState,
        ledgerParameters,
      ] as typeof result;
    },
  };

  const proofProvider = httpClientProofProvider(config.proverServerUri!, zkConfigProvider);

  const shieldedAddress = (await connectedAPI.getShieldedAddresses()) as ShieldedAddress;

  const { walletProvider, midnightProvider } = createWalletProvidersFromConnectedAPI(
    connectedAPI,
    shieldedAddress,
  );

  const privateStateProvider = levelPrivateStateProvider({
    privateStoragePasswordProvider: () => 'Aa1!midnight-id-browser-store',
    accountId: shieldedAddress.shieldedAddress,
  });

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}
