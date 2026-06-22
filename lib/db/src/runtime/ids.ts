// =============================================================================
// Vitalé — app-side UUIDv7 generation (runtime counterpart of the pkV7() column)
// -----------------------------------------------------------------------------
// VITALE_DB_ARCHITECTURE §2/§9: primary keys are app-generated UUIDv7 (time-ordered
// → B-tree index locality). The DB columns (pkV7() in schema/_shared.ts) carry NO
// default — the application MUST supply the v7 id on insert. This module is that
// supplier.
//
// Why generate in TS rather than rely on a DB default:
//   * Keeps id allocation deterministic and visible to the app before the round-trip
//     (needed for returning ids, optimistic flows, and multi-row graph inserts).
//   * Avoids depending on the OPTIONAL pg_uuidv7 extension (migration 0001 notes it
//     may be absent); PG18 native uuidv7() exists but we keep generation app-side
//     per the pkV7 convention so behaviour is identical across environments.
//
// Implementation: RFC 9562 §5.7 UUID version 7.
//   - 48 bits: Unix epoch milliseconds (big-endian) → time-ordering
//   - 4 bits : version (0b0111 = 7)
//   - 12 bits: rand_a (random)
//   - 2 bits : variant (0b10)
//   - 62 bits: rand_b (random)
// No third-party dependency (honours the workspace minimumReleaseAge posture).
// =============================================================================
import { randomFillSync } from "node:crypto";

/**
 * Generate a new RFC 9562 UUIDv7 (lowercase, hyphenated) suitable for any pkV7()
 * primary-key column. Monotonic at millisecond granularity; within the same
 * millisecond ordering falls back to randomness (acceptable for index locality).
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  randomFillSync(bytes);

  // 48-bit big-endian millisecond timestamp into bytes[0..5]. BigInt keeps the
  // arithmetic exact and avoids any 32-bit coercion ambiguity.
  let ts = BigInt(Date.now());
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }

  // Version 7 in the high nibble of byte 6 (low nibble stays random = rand_a hi).
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // RFC 4122/9562 variant 0b10 in the two high bits of byte 8.
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

/** Strict UUID (any version/variant) shape check — useful at trust boundaries. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
