import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import {
  connectionsForPort,
  instancesByCategory,
  isPdOutputChannel,
  otherEnd,
  resolvePort,
} from "../graph.js";
import type { Violation } from "../types.js";

/** Categories that are part of the main power chain (R609), not branch-circuit loads. */
const MAIN_CHAIN_CATEGORIES = new Set(["battery", "protection", "power-distribution"]);

/**
 * R610 (2026): every branch circuit must be sourced from a single protected
 * output channel of the PD. Circuits must not connect to the PD's main power
 * input. A device drawing power from anything other than a protected PD
 * channel is an error.
 */
export function checkBranchCircuitSources(
  diagram: DiagramProject,
  library: DeviceLibrary,
): Violation[] {
  const violations: Violation[] = [];

  for (const instance of diagram.instances) {
    const device = library[instance.deviceId];
    if (!device || MAIN_CHAIN_CATEGORIES.has(device.category)) continue;

    for (const port of device.ports) {
      if (port.type !== "power" || port.direction !== "input") continue;

      for (const conn of connectionsForPort(diagram, instance.id, port.id)) {
        const other = otherEnd(conn, instance.id, port.id);
        const {
          instance: otherInstance,
          device: otherDevice,
          port: otherPort,
        } = resolvePort(diagram, library, other);

        if (!isPdOutputChannel(otherDevice, otherPort)) {
          violations.push({
            ruleId: "R610",
            layer: 1,
            severity: "error",
            message: `${instance.name}'s ${port.name} is powered from ${otherInstance.name}'s ${otherPort.name}, not a protected PD output channel.`,
            affectedInstanceIds: [instance.id, otherInstance.id],
            affectedConnectionIds: [conn.id],
          });
        }
      }
    }
  }

  for (const pd of instancesByCategory(diagram, library, "power-distribution")) {
    const pdDevice = library[pd.deviceId]!;

    for (const port of pdDevice.ports) {
      if (port.type !== "power" || port.direction !== "input") continue;

      for (const conn of connectionsForPort(diagram, pd.id, port.id)) {
        const other = otherEnd(conn, pd.id, port.id);
        const { instance: otherInstance, device: otherDevice } = resolvePort(
          diagram,
          library,
          other,
        );

        if (!MAIN_CHAIN_CATEGORIES.has(otherDevice.category)) {
          violations.push({
            ruleId: "R610",
            layer: 1,
            severity: "error",
            message: `${pd.name}'s ${port.name} (main power input) has a branch circuit connected to it from ${otherInstance.name}. Branch circuits must connect to a protected output channel, not the main power input.`,
            affectedInstanceIds: [pd.id, otherInstance.id],
            affectedConnectionIds: [conn.id],
          });
        }
      }
    }
  }

  return violations;
}
