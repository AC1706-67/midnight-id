// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react';
import { ManoIssuerAPI, pureCircuits } from '@midnight-ntwrk/bboard-api';
import { buildBrowserProviders } from '../lib/providers';
import { useWalletDetection } from '../hooks/useWalletDetection';

const ISSUER_SK_KEY = 'mano.issuerSk';
const CONTRACT_NAME = 'bboard';
const NETWORK_ID = 'preprod';

function hex(b: Uint8Array) {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}
function unhex(h: string) {
  const c = h.trim().replace(/^0x/, '');
  return new Uint8Array((c.match(/.{1,2}/g) ?? []).map((p) => parseInt(p, 16)));
}
function randomBytes32() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
}
function loadIssuerSk(): Uint8Array {
  const stored = localStorage.getItem(ISSUER_SK_KEY);
  if (stored) return unhex(stored);
  const sk = randomBytes32();
  localStorage.setItem(ISSUER_SK_KEY, hex(sk));
  return sk;
}

export function IssuerPanel() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState('');
  const [cardSecret, setCardSecret] = useState('');
  const say = (m: string) => setLog((l) => [...l, m]);
  const { availableAPIs, isDetecting } = useWalletDetection(say);

  // Fresh connect on every action: the connector handle goes stale across lock/unlock.
  async function getProviders() {
    if (availableAPIs.length === 0) throw new Error('no Midnight wallet detected');
    const connected = await availableAPIs[0].connect(NETWORK_ID);
    const p = await buildBrowserProviders(connected as any, CONTRACT_NAME);
    return p as unknown as Parameters<typeof ManoIssuerAPI.deploy>[0];
  }

  async function onDeploy() {
    setBusy(true);
    try {
      say('connecting...');
      const providers = await getProviders();
      say('deploying contract (~30s on Preprod)...');
      const issuer = await ManoIssuerAPI.deploy(providers, loadIssuerSk());
      setAddress(issuer.deployedContractAddress);
      say('DEPLOYED: ' + issuer.deployedContractAddress);
    } catch (e: any) {
      console.error('DEPLOY FAILED', e);
      try {
        console.error('CAUSE JSON', JSON.stringify(e?.cause, Object.getOwnPropertyNames(e?.cause ?? {}), 2));
        let c: any = e?.cause;
        for (let i = 0; i < 8 && c; i++) {
          console.error('cause[' + i + ']', c?._tag, c?.message, c?.error?.message, c);
          c = c?.cause ?? c?.error ?? c?.failure ?? c?.defect;
        }
      } catch (x) { console.error('unwrap failed', x); }
      say('ERROR: ' + (e?.message || e?.reason || e?.code || JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}))));
    } finally {
      setBusy(false);
    }
  }

  async function onEnroll() {
    setBusy(true);
    try {
      if (!address.trim()) throw new Error('deploy or paste a contract address first');
      // Participant secret stays in this scope. Never logged, never persisted.
      const sk = cardSecret.trim() ? unhex(cardSecret) : randomBytes32();
      if (sk.length !== 32) throw new Error('card secret must be 64 hex chars');
      const commitment = pureCircuits.publicCommitment(sk);
      say('commitment: ' + hex(commitment));
      say('connecting...');
      const providers = await getProviders();
      say('joining contract...');
      const issuer = await ManoIssuerAPI.join(providers, address.trim(), loadIssuerSk());
      say('proving + submitting enroll (~30s)...');
      const txHash = await issuer.enroll(commitment);
      say('ENROLLED. txHash: ' + txHash);
    } catch (e: any) {
      say('ERROR: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h2>Issuer Panel</h2>
      <p>{isDetecting ? 'detecting wallet...' : availableAPIs.length + ' wallet(s)'}</p>
      <button onClick={onDeploy} disabled={busy || isDetecting}>deploy contract</button>
      <div style={{ marginTop: 12 }}>
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
          placeholder="card secret (64 hex chars) - leave blank to generate"
          value={cardSecret}
          onChange={(e) => setCardSecret(e.target.value)}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setCardSecret(hex(randomBytes32()))} disabled={busy}>generate card secret</button>
        <button style={{ marginLeft: 8 }} onClick={onEnroll} disabled={busy || isDetecting}>enroll participant</button>
      </div>
      <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
    </div>
  );
}
