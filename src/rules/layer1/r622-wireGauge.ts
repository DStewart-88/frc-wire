import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import { getProtectionRating } from "../graph.js";
import { minimumGaugeForProtection } from "../gauge.js";
import type { Violation } from "../types.js";

/**
 * R622 (2026): wire must be at least as large as Table 8-4 requires for the
 * breaker/fuse protecting it (lower AWG number = thicker wire, so the
 * recorded gauge must be <= the table's minimum). A circuit with no recorded
 * wire gauge can't be checked and is reported as "incomplete" rather than an
 * error — the diagram isn't fully valid until a gauge is entered, but it
 * isn't necessarily wrong either.
 */
export function checkWireGauge(diagram: DiagramProject, library: DeviceLibrary): Violation[] {
  const violations: Violation[] = [];

  for (const conn of diagram.connections) {
    const rating = getProtectionRating(diagram, library, conn);
    if (rating === undefined) continue;

    const affectedInstanceIds = [conn.from.instanceId, conn.to.instanceId];

    if (conn.wireGauge === undefined) {
      violations.push({
        ruleId: "R622",
        layer: 1,
        severity: "incomplete",
        message: `This circuit is protected at ${rating}A but has no wire gauge recorded. A gauge must be entered before the diagram is complete.`,
        affectedInstanceIds,
        affectedConnectionIds: [conn.id],
      });
      continue;
    }

    const minGauge = minimumGaugeForProtection(rating);
    if (minGauge === undefined) continue;

    if (conn.wireGauge > minGauge) {
      violations.push({
        ruleId: "R622",
        layer: 1,
        severity: "error",
        message: `This circuit is protected at ${rating}A, which requires at least ${minGauge} AWG per Table 8-4, but the wire is ${conn.wireGauge} AWG.`,
        affectedInstanceIds,
        affectedConnectionIds: [conn.id],
      });
    }
  }

  return violations;
}
