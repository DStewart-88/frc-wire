import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import {
  connectionsForPort,
  getChannelBreakerRating,
  instancesByCategory,
  otherEnd,
  resolvePort,
} from "../graph.js";
import type { Violation } from "../types.js";

/** Standard ATO/ATC breaker/fuse values legal for protecting a used PD channel. */
const LEGAL_BREAKER_VALUES = [5, 7.5, 10, 15, 20, 25, 30, 40];

/** Channels rated above this may only protect motor controllers (Table 8-3). */
const GENERAL_LOAD_MAX_AMPS = 15;

/**
 * R619/R620 (2026): a used PD output channel must be protected by one of the
 * standard breaker/fuse values (R619). A channel protected above 15A may only
 * power motor controllers (R620).
 */
export function checkBreakerValues(diagram: DiagramProject, library: DeviceLibrary): Violation[] {
  const violations: Violation[] = [];

  for (const pd of instancesByCategory(diagram, library, "power-distribution")) {
    const pdDevice = library[pd.deviceId]!;

    for (const channel of pdDevice.ports) {
      if (channel.type !== "power" || channel.direction !== "output") continue;

      const connections = connectionsForPort(diagram, pd.id, channel.id);
      if (connections.length === 0) continue;

      const rating = getChannelBreakerRating(pd, channel);

      if (!LEGAL_BREAKER_VALUES.includes(rating)) {
        violations.push({
          ruleId: "R619",
          layer: 1,
          severity: "error",
          message: `${pd.name}'s ${channel.name} is protected at ${rating}A, which is not a legal PD breaker/fuse value (${LEGAL_BREAKER_VALUES.join(", ")}A).`,
          affectedInstanceIds: [pd.id],
          affectedConnectionIds: connections.map((c) => c.id),
        });
        continue;
      }

      if (rating > GENERAL_LOAD_MAX_AMPS) {
        const loads = connections.map((conn) =>
          resolvePort(diagram, library, otherEnd(conn, pd.id, channel.id)),
        );
        const allMotorControllers = loads.every((l) => l.device.category === "motor-controller");

        if (!allMotorControllers) {
          violations.push({
            ruleId: "R620",
            layer: 1,
            severity: "error",
            message: `${pd.name}'s ${channel.name} is protected at ${rating}A, above the ${GENERAL_LOAD_MAX_AMPS}A general limit. Breakers above ${GENERAL_LOAD_MAX_AMPS}A may only power motor controllers.`,
            affectedInstanceIds: [pd.id, ...loads.map((l) => l.instance.id)],
            affectedConnectionIds: connections.map((c) => c.id),
          });
        }
      }
    }
  }

  return violations;
}
