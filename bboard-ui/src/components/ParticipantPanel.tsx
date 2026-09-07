// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react';
import { ManoParticipantAPI } from '@midnight-ntwrk/bboard-api';
import { buildBrowserProviders } from '../lib/providers';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider';
import { useWalletDetection } from '../hooks/useWalletDetection';

const CONTRACT_NAME = 'bboard';
const NETWORK_ID = 'preprod';

function unhex(h: string) {
  const c = h.trim().replace(/^0x/, '');
  return new Uint8Array((c.match(/.{1,2}/g) ?? []).map((p) => parseInt(p, 16)));
}

// Date encoding: YYYYMMDD ascii, right-padded to 32 bytes.
function todayBytes(): Uint8Array {
  const d = new Date();
  const s =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const out = new Uint8Array(32);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function ParticipantPanel() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState('');
  const [cardSecret, setCardSecret] = useState('');
  const say = (m: string) => setLog((l) => [...l, m]);
  const { availableAPIs, isDetecting } = useWalletDetection(say);

  async function getParticipantProviders() {
    if (availableAPIs.length === 0) throw new Error('no Midnight wallet detected');
    const connected = await availableAPIs[0].connect(NETWORK_ID);
    const p: any = await buildBrowserProviders(connected as any, CONTRACT_NAME);
    // 42 CFR Part 2: participant secret must never reach disk.
    p.privateStateProvider = inMemoryPrivateStateProvider();
    return p as Parameters<typeof ManoParticipantAPI.join>[0];
  }

  async function run(label: string, fn: (api: any) => Promise<void>) {
    setBusy(true);
    let api: any = null;
    try {
      if (!address.trim()) throw new Error('paste the contract address first');
      const sk = unhex(cardSecret);
      if (sk.length !== 32) throw new Error('card secret must be 64 hex chars');
      say('connecting...');
      const providers = await getParticipantProviders();
      say('joining contract...');
      api = await ManoParticipantAPI.join(providers, address.trim(), sk);
      const t0 = performance.now();
      say(label + ' (proving, ~30s)...');
      await fn(api);
      say('SUCCESS: ' + label + ' in ' + Math.round(performance.now() - t0) + 'ms');
    } catch (e: any) {
      const c1: any = e?.cause?.failure ?? e?.cause;
      const msg = e?.message || c1?.message || c1?._tag || JSON.stringify(e);
      console.error(label + ' failed', e);
      say('REJECTED: ' + msg);
    } finally {
      // Drop the card secret whether it worked or not.
      try { await api?.close(); say('session closed - card secret discarded'); } catch {}
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: 16, borderTop: '2px solid #333' }}>
      <h2>Participant Kiosk</h2>
      <p>{isDetecting ? 'detecting wallet...' : availableAPIs.length + ' wallet(s)'}</p>
      <div>
        <input
          style={{ width: 620 }}
          placeholder="contract address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          style={{ width: 620 }}
          placeholder="card secret (64 hex chars) - must match an enrolled card"
          value={cardSecret}
          onChange={(e) => setCardSecret(e.target.value)}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <button disabled={busy || isDetecting} onClick={() => run('check in', (a) => a.checkIn(todayBytes()))}>
          check in
        </button>
        <button
          style={{ marginLeft: 8 }}
          disabled={busy || isDetecting}
          onClick={() => run('verify credential', (a) => a.verifyCredential())}
        >
          verify credential
        </button>
      </div>
      <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
    </div>
  );
}
