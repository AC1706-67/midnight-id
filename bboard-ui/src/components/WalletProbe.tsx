import { useState } from 'react';
import { useWalletDetection } from '../hooks/useWalletDetection';
import { ManoIssuerAPI } from '@midnight-ntwrk/bboard-api';
import { buildBrowserProviders } from '../lib/providers';

export function WalletProbe() {
  const [log, setLog] = useState<string[]>([]);
  const [netId, setNetId] = useState('preprod');
  const add = (m: string) => setLog((l) => [...l, m]);
  const { availableAPIs, isDetecting } = useWalletDetection(add);

  async function probe(api: any) {
    try {
      add('connecting with networkId=' + netId);
      const c = await api.connect(netId);
      add('CONNECTED');
      const cfg = await c.getConfiguration();
      add('config: ' + JSON.stringify(cfg, null, 2));
      add('getProvingProvider is ' + typeof c.getProvingProvider);
      const un = await c.getUnshieldedAddress();
      add('unshielded: ' + JSON.stringify(un));
      add('ManoIssuerAPI imported: ' + typeof ManoIssuerAPI);
      add('buildBrowserProviders: ' + typeof buildBrowserProviders);
    } catch (e: any) {
      add('ERROR: ' + (e?.message ?? String(e)));
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: 20 }}>
      <h2>Wallet Probe</h2>
      <input value={netId} onChange={(e) => setNetId(e.target.value)} />
      <p>{isDetecting ? 'detecting...' : availableAPIs.length + ' wallet(s)'}</p>
      {availableAPIs.map((a, i) => (
        <button key={i} onClick={() => probe(a)}>connect {a.name}</button>
      ))}
      <pre style={{ whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
    </div>
  );
}
