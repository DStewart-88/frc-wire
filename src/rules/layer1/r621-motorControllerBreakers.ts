import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import { connectionsForPort, instancesByCategory, otherEnd, resolvePort } from "../graph.js";
import type { Violation } from "../types.js";

/**
 * R621 (2026): each motor controller must be on its own PD breaker/fuse. A
 * channel feeding two or more motor controllers, or a motor controller plus
 * any other load, is an error.
 */
export function checkMotorControllerBreakerSharing(
  diagram: DiagramProject,
  library: DeviceLibrary,
): Violation[] {
  const violations: Violation[] = [];

  for (const pd of instancesByCategory(diagram, library, "power-distribution")) {
    const pdDevice = library[pd.deviceId]!;

    for (const channel of pdDevice.ports) {
      if (channel.type !== "power" || channel.direction !== "output") continue;

      const connections = connectionsForPort(diagram, pd.id, channel.id);
      if (connections.length < 2) continue;

      const loads = connections.map((conn) => ({
        conn,
        ...resolvePort(diagram, library, otherEnd(conn, pd.id, channel.id)),
      }));
      const motorControllerLoads = loads.filter((l) => l.device.category === "motor-controller");
      if (motorControllerLoads.length === 0) continue;

      const message =
        motorControllerLoads.length > 1
          ? `${pd.name}'s ${channel.name} powers ${motorControllerLoads.length} motor controllers (${motorControllerLoads.map((l) => l.instance.name).join(", ")}). Each motor controller must be on its own breaker.`
          : `${pd.name}'s ${channel.name} powers a motor controller (${motorControllerLoads[0]!.instance.name}) and ${connections.length - 1} other load(s). A motor controller's breaker must not be shared with another load.`;

      violations.push({
        ruleId: "R621",
        layer: 1,
        severity: "error",
        message,
        affectedInstanceIds: [pd.id, ...loads.map((l) => l.instance.id)],
        affectedConnectionIds: connections.map((c) => c.id),
      });
    }
  }

  return violations;
}
