/**
 * Wire gauge vs. circuit protection — Table 8-4 (2026 Game Manual).
 * Used by R622 (see src/rules/layer1/r622-wireGauge.ts).
 */
import type { DeviceLibrary } from "../library/loadLibrary.js";
import type { Connection, DiagramProject } from "../types/diagram.js";
import { getProtectionRating } from "./graph.js";

/**
 * Table 8-4: minimum wire gauge (AWG) required for a circuit protected at up
 * to `maxAmps`. Rows are checked in order, so list them ascending by
 * `maxAmps`. AWG numbers run opposite to wire thickness — lower numbers are
 * thicker wire — so "at least as large as the table requires" means the
 * connection's gauge must be numerically <= the table's minGauge.
 */
const GAUGE_TABLE: ReadonlyArray<{ maxAmps: number; minGauge: number }> = [
  { maxAmps: 20, minGauge: 18 },
  { maxAmps: 30, minGauge: 14 },
  { maxAmps: 40, minGauge: 12 },
  { maxAmps: 120, minGauge: 6 },
];

/**
 * The minimum legal wire gauge (AWG) for a circuit protected at
 * `breakerAmps`, per Table 8-4. Returns undefined if `breakerAmps` exceeds
 * every row in the table (out of range for any PD-fed or main-chain circuit).
 */
export function minimumGaugeForProtection(breakerAmps: number): number | undefined {
  for (const row of GAUGE_TABLE) {
    if (breakerAmps <= row.maxAmps) return row.minGauge;
  }
  return undefined;
}

/**
 * R622 derivation helper: the minimum legal wire gauge (AWG) for
 * `connection`, given the breaker/fuse that protects it. Returns undefined
 * if the connection isn't part of a circuit with a determinable protection
 * level (e.g. a CAN or signal connection) — a later UI would leave gauge
 * entry manual in that case.
 */
export function deriveMinimumWireGauge(
  diagram: DiagramProject,
  library: DeviceLibrary,
  connection: Connection,
): number | undefined {
  const rating = getProtectionRating(diagram, library, connection);
  if (rating === undefined) return undefined;
  return minimumGaugeForProtection(rating);
}
