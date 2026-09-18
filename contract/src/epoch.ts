import { convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";

/**
 * Convert a Counter ledger value into the Bytes<32> encoding the circuits use.
 *
 * `checkIn` and `verifyCredential` compute `currentEpoch as Field as Bytes<32>`
 * internally. Every caller deriving a commitment off-chain must produce the
 * identical bytes, or the derived commitment will not match the enrolled leaf
 * and check-in fails with "path does not match credential" - which looks
 * exactly like an unenrolled card.
 *
 * Encoding is little-endian: epoch 1 -> 0x0100...00.
 *
 * NOTE: convertFieldToBytes is marked @internal in the runtime's typings. It is
 * what the generated contract code itself uses, so it matches the circuit by
 * construction, but it is not a stability-guaranteed API. Isolated here on
 * purpose: if a future compactc moves it, this is the only line to change.
 */
export const epochToBytes = (epoch: bigint): Uint8Array =>
  convertFieldToBytes(32, epoch, "epochToBytes");
