/**
 * Midnight ID - three-panel demo UI.
 * Runs the real compiled contract locally via the test simulator (Route B).
 * Local aliases never leave the browser; the chain strip shows only hashes and counts.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { MidnightIdSimulator } from '../../../contract/src/test/midnight-id-simulator.js';

// --- helpers ---------------------------------------------------------

const textBytes32 = (s: string): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(s).slice(0, 32));
  return out;
};

const randomBytes32 = (): Uint8Array => {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  return out;
};

const toHex = (b: Uint8Array): string =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

const shortHash = (b: Uint8Array): string => {
  const h = toHex(b);
  return `${h.slice(0, 8)}…${h.slice(-8)}`;
};

const todayBytes = (): Uint8Array =>
  textBytes32(new Date().toISOString().slice(0, 10));

type Person = {
  alias: string; // LOCAL ONLY - never leaves the browser
  secretKey: Uint8Array;
  leafIndex: bigint;
  commitment: Uint8Array;
};

type ChainEvent = { label: string; hash: string };

// --- component -------------------------------------------------------

export const MidnightId: React.FC = () => {
  const simRef = useRef<MidnightIdSimulator | null>(null);

  const getSim = (): MidnightIdSimulator => {
    if (!simRef.current) {
      simRef.current = new MidnightIdSimulator(randomBytes32());
    }
    return simRef.current;
  };

  const [people, setPeople] = useState<Person[]>([]);
  const [enrollAlias, setEnrollAlias] = useState('');
  const [checkInIdx, setCheckInIdx] = useState<number | ''>('');
  const [verifyIdx, setVerifyIdx] = useState<number | ''>('');
  const [enrollmentCount, setEnrollmentCount] = useState(0n);
  const [totalCheckIns, setTotalCheckIns] = useState(0n);
  const [chainEvents, setChainEvents] = useState<ChainEvent[]>([]);
  const [message, setMessage] = useState('');
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null);

  const refreshCounts = () => {
    const ledger = getSim().getLedger();
    setEnrollmentCount(ledger.enrollmentCount);
    setTotalCheckIns(ledger.totalCheckIns);
  };

  const actAs = (p: Person) => {
    const sim = getSim();
    const path = sim.pathFor(p.leafIndex, p.commitment);
    sim.switchUser({ secretKey: p.secretKey, leafIndex: p.leafIndex, currentPath: path });
  };

  const onEnroll = () => {
    setVerifyResult(null);
    if (!enrollAlias.trim()) {
      setMessage('Enter a local alias first.');
      return;
    }
    try {
      const sim = getSim();
      const secretKey = randomBytes32();
      const commitment = sim.commitmentFor(secretKey);
      sim.enroll(commitment);
      const person: Person = {
        alias: enrollAlias.trim(),
        secretKey,
        leafIndex: BigInt(people.length),
        commitment,
      };
      setPeople((prev) => [...prev, person]);
      setChainEvents((prev) => [
        { label: 'Commitment added', hash: shortHash(commitment) },
        ...prev,
      ]);
      setEnrollAlias('');
      setMessage(`Credential issued for "${person.alias}" (alias stays on this device).`);
      refreshCounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const onCheckIn = () => {
    setVerifyResult(null);
    if (checkInIdx === '') {
      setMessage('Pick a credential holder to check in.');
      return;
    }
    const p = people[checkInIdx];
    try {
      actAs(p);
      getSim().checkIn(todayBytes());
      setChainEvents((prev) => [
        { label: 'Anonymous check-in (nullifier burned)', hash: shortHash(p.commitment) },
        ...prev,
      ]);
      setMessage(`Check-in accepted. The chain saw a valid proof - not a person.`);
      refreshCounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(
        msg.includes('already')
          ? `Rejected: this credential already checked in today.`
          : `Rejected: ${msg}`,
      );
    }
  };

  const onVerify = () => {
    if (verifyIdx === '') {
      setMessage('Pick a credential to verify.');
      return;
    }
    const p = people[verifyIdx];
    try {
      actAs(p);
      getSim().verifyCredential();
      setVerifyResult('valid');
      setMessage('Verified: holds a valid Midnight ID credential. Nothing else revealed.');
    } catch {
      setVerifyResult('invalid');
      setMessage('Verification failed: not a valid credential.');
    }
  };

  const panelSx = useMemo(() => ({ flex: 1, minWidth: 260 }), []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* Panel 1 - Enroll (org side) */}
        <Card sx={panelSx}>
          <CardHeader title="Enroll" subheader="Org staff issues a credential" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              label="Local alias (never leaves this device)"
              size="small"
              value={enrollAlias}
              onChange={(e) => setEnrollAlias(e.target.value)}
            />
            <Button variant="contained" onClick={onEnroll}>
              Issue credential
            </Button>
          </CardContent>
        </Card>

        {/* Panel 2 - Check In (participant side) */}
        <Card sx={panelSx}>
          <CardHeader title="Check In" subheader="Participant proves membership" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Select
              size="small"
              displayEmpty
              value={checkInIdx}
              onChange={(e) => setCheckInIdx(e.target.value as number)}
            >
              <MenuItem value="" disabled>
                Select credential holder
              </MenuItem>
              {people.map((p, i) => (
                <MenuItem key={i} value={i}>
                  {p.alias}
                </MenuItem>
              ))}
            </Select>
            <Button variant="contained" size="large" onClick={onCheckIn} disabled={people.length === 0}>
              Check in today
            </Button>
          </CardContent>
        </Card>

        {/* Panel 3 - Verify (third-party side) */}
        <Card sx={panelSx}>
          <CardHeader title="Verify" subheader="A different org checks validity" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Select
              size="small"
              displayEmpty
              value={verifyIdx}
              onChange={(e) => setVerifyIdx(e.target.value as number)}
            >
              <MenuItem value="" disabled>
                Select credential
              </MenuItem>
              {people.map((p, i) => (
                <MenuItem key={i} value={i}>
                  {p.alias}
                </MenuItem>
              ))}
            </Select>
            <Button variant="outlined" onClick={onVerify} disabled={people.length === 0}>
              Verify credential
            </Button>
            {verifyResult && (
              <Chip
                label={verifyResult === 'valid' ? 'VALID CREDENTIAL' : 'INVALID'}
                color={verifyResult === 'valid' ? 'success' : 'error'}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      {message && (
        <Typography variant="body2" sx={{ px: 1 }}>
          {message}
        </Typography>
      )}

      <Divider />

      {/* Signature element - the chain strip */}
      <Card variant="outlined">
        <CardHeader
          title="What the chain sees"
          subheader="No names. No identities. Only proofs, hashes, and counts."
        />
        <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="overline">Enrollments</Typography>
            <Typography variant="h4">{enrollmentCount.toString()}</Typography>
          </Box>
          <Box>
            <Typography variant="overline">Total check-ins</Typography>
            <Typography variant="h4">{totalCheckIns.toString()}</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Typography variant="overline">Ledger activity</Typography>
            {chainEvents.length === 0 ? (
              <Typography variant="body2">No activity yet.</Typography>
            ) : (
              chainEvents.slice(0, 6).map((ev, i) => (
                <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {ev.label}: {ev.hash}
                </Typography>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
