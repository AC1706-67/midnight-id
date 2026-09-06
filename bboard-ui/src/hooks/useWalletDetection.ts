import { useEffect, useState } from 'react';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

type MidnightWindow = Window & { midnight?: Record<string, any> };

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 40;

function findInitialAPIs(): InitialAPI[] {
  const midnight = (window as MidnightWindow).midnight;
  if (!midnight) return [];
  const apis: InitialAPI[] = [];
  for (const key of Object.keys(midnight)) {
    const c = midnight[key];
    if (
      c &&
      typeof c === 'object' &&
      typeof c.name === 'string' &&
      typeof c.apiVersion === 'string' &&
      typeof c.connect === 'function'
    ) {
      apis.push(c as InitialAPI);
    }
  }
  return apis;
}

export function useWalletDetection(onLog?: (msg: string) => void) {
  const [availableAPIs, setAvailableAPIs] = useState<InitialAPI[]>([]);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const id = setInterval(() => {
      const apis = findInitialAPIs();
      if (apis.length > 0) {
        clearInterval(id);
        setAvailableAPIs(apis);
        setIsDetecting(false);
        onLog?.('Found: ' + apis.map((a) => a.name).join(', '));
      } else if (++attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(id);
        setIsDetecting(false);
        onLog?.('No Midnight wallet detected');
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return { availableAPIs, isDetecting };
}
