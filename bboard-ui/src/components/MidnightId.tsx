/*
 * Midnight ID - three-panel demo UI.
 * All state lives on the local demo server; this page just displays it.
 * Aliases stay on the org's device. The chain strip shows hashes and counts only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  createTheme,
  ThemeProvider,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  TextField,
  Typography,
} from '@mui/material';

const API = 'http://localhost:4400';

type PersonRow = { index: number; alias: string };
type ChainEvent = { label: string; hash: string };
type Snapshot = {
  ok: boolean;
  enrollmentCount: string;
  totalCheckIns: string;
  people: PersonRow[];
  events: ChainEvent[];
  error?: string;
};

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '1rem',
  color: '#e8e8e8',
  backgroundColor: '#1e1e1e',
  border: '1px solid #555',
  borderRadius: 6,
  width: '100%',
};

export const MidnightId: React.FC = () => {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [enrollAlias, setEnrollAlias] = useState('');
  const [checkInIdx, setCheckInIdx] = useState('');
  const [verifyIdx, setVerifyIdx] = useState('');
  const [message, setMessage] = useState('');
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null);

  const call = useCallback(async (path: string, body?: object): Promise<Snapshot> => {
    const res = await fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as Snapshot;
    if (!data.ok) throw new Error(data.error ?? 'request failed');
    return data;
  }, []);

  useEffect(() => {
    call('/state')
      .then(setSnap)
      .catch(() =>
        setMessage('Cannot reach the demo server. Is it running on port 4400?'),
      );
  }, [call]);

  const onEnroll = async () => {
    setVerifyResult(null);
    if (!enrollAlias.trim()) {
      setMessage('Enter a local alias first.');
      return;
    }
    try {
      const data = await call('/enroll', { alias: enrollAlias });
      setSnap(data);
      setMessage(`Credential issued for "${enrollAlias.trim()}" (alias stays on this device).`);
      setEnrollAlias('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const onCheckIn = async () => {
    setVerifyResult(null);
    if (checkInIdx === '') {
      setMessage('Pick a credential holder to check in.');
      return;
    }
    try {
      const data = await call('/check-in', {
        index: Number(checkInIdx),
        date: new Date().toISOString().slice(0, 10),
      });
      setSnap(data);
      setMessage('Check-in accepted. The chain saw a valid proof - not a person.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(
        msg.includes('already')
          ? 'Rejected: this credential already checked in today.'
          : `Rejected: ${msg}`,
      );
    }
  };

  const onVerify = async () => {
    if (verifyIdx === '') {
      setMessage('Pick a credential to verify.');
      return;
    }
    try {
      const data = await call('/verify', { index: Number(verifyIdx) });
      setSnap(data);
      setVerifyResult('valid');
      setMessage('Verified: holds a valid Midnight ID credential. Nothing else revealed.');
    } catch {
      setVerifyResult('invalid');
      setMessage('Verification failed: not a valid credential.');
    }
  };

  const people = snap?.people ?? [];
  const events = snap?.events ?? [];

  return (
    <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 260 }}>
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

        <Card sx={{ flex: 1, minWidth: 260 }}>
          <CardHeader title="Check In" subheader="Participant proves membership" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <select
              style={selectStyle}
              value={checkInIdx}
              onChange={(e) => setCheckInIdx(e.target.value)}
            >
              <option value="" disabled>
                Select credential holder
              </option>
              {people.map((p) => (
                <option key={p.index} value={p.index}>
                  {p.alias}
                </option>
              ))}
            </select>
            <Button variant="contained" size="large" onClick={onCheckIn} disabled={people.length === 0}>
              Check in today
            </Button>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 260 }}>
          <CardHeader title="Verify" subheader="A different org checks validity" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <select
              style={selectStyle}
              value={verifyIdx}
              onChange={(e) => setVerifyIdx(e.target.value)}
            >
              <option value="" disabled>
                Select credential
              </option>
              {people.map((p) => (
                <option key={p.index} value={p.index}>
                  {p.alias}
                </option>
              ))}
            </select>
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

      <Card variant="outlined">
        <CardHeader
          title="What the chain sees"
          subheader="No names. No identities. Only proofs, hashes, and counts."
        />
        <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="overline">Enrollments</Typography>
            <Typography variant="h4">{snap?.enrollmentCount ?? '0'}</Typography>
          </Box>
          <Box>
            <Typography variant="overline">Total check-ins</Typography>
            <Typography variant="h4">{snap?.totalCheckIns ?? '0'}</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Typography variant="overline">Ledger activity</Typography>
            {events.length === 0 ? (
              <Typography variant="body2">No activity yet.</Typography>
            ) : (
              events.map((ev, i) => (
                <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {ev.label}: {ev.hash}
                </Typography>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
    </ThemeProvider>
  );
};
