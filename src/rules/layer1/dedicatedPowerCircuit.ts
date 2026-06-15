import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DeviceInstance, DiagramProject } from "../../types/diagram.js";
import {
  connectionsForPort,
  getChannelBreakerRating,
  isPdOutputChannel,
  otherEnd,
  resolvePort,
} from "../graph.js";
import type { Violation } from "../types.js";

/** Rule IDs to attach to each failure mode, since R615 and R616/R617 share this shape but cite different rules. */
export interface DedicatedCircuitRuleIds {
  /** Power input missing or has more than one connection. */
  notConnected: string;
  /** Source is not a protected PD output channel at all. */
  wrongSource: string;
  /** Source channel is switchable, wrong amperage, or shared with another load. */
  switchedOrShared: string;
}

/**
 * Shared check for "this device's power input must be wired to a dedicated,
 * non-switched PD output channel protected at exactly `requiredAmps`, with no
 * other load on that channel". Used by R615 (roboRIO) and R616/R617 (radio),
 * which both require this exact shape.
 */
export function checkDedicatedPdCircuit(
  diagram: DiagramProject,
  library: DeviceLibrary,
  instance: DeviceInstance,
  requiredAmps: number,
  ruleIds: DedicatedCircuitRuleIds,
): Violation[] {
  const violations: Violation[] = [];
  const device = library[instance.deviceId]!;
  const powerIn = device.ports.find((p) => p.type === "power" && p.direction === "input");
  if (!powerIn) return violations;

  const connections = connectionsForPort(diagram, instance.id, powerIn.id);

  if (connections.length === 0) {
    return [
      {
        ruleId: ruleIds.notConnected,
        layer: 1,
        severity: "error",
        message: `${instance.name}'s ${powerIn.name} is not connected to a power source.`,
        affectedInstanceIds: [instance.id],
        affectedConnectionIds: [],
      },
    ];
  }

  if (connections.length > 1) {
    return [
      {
        ruleId: ruleIds.notConnected,
        layer: 1,
        severity: "error",
        message: `${instance.name}'s ${powerIn.name} has ${connections.length} power connections; it must have exactly one.`,
        affectedInstanceIds: [instance.id],
        affectedConnectionIds: connections.map((c) => c.id),
      },
    ];
  }

  const conn = connections[0]!;
  const other = otherEnd(conn, instance.id, powerIn.id);
  const {
    instance: pdInstance,
    device: pdDevice,
    port: channel,
  } = resolvePort(diagram, library, other);

  if (!isPdOutputChannel(pdDevice, channel)) {
    return [
      {
        ruleId: ruleIds.wrongSource,
        layer: 1,
        severity: "error",
        message: `${instance.name} is not powered from a protected PD output channel.`,
        affectedInstanceIds: [instance.id, pdInstance.id],
        affectedConnectionIds: [conn.id],
      },
    ];
  }

  if (channel.switchable) {
    violations.push({
      ruleId: ruleIds.switchedOrShared,
      layer: 1,
      severity: "error",
      message: `${instance.name} is powered from ${pdInstance.name}'s ${channel.name}, which is a switchable channel. It must be on a non-switched channel.`,
      affectedInstanceIds: [instance.id, pdInstance.id],
      affectedConnectionIds: [conn.id],
    });
  }

  const rating = getChannelBreakerRating(pdInstance, channel);
  if (rating !== requiredAmps) {
    violations.push({
      ruleId: ruleIds.switchedOrShared,
      layer: 1,
      severity: "error",
      message: `${instance.name} is powered from ${pdInstance.name}'s ${channel.name}, protected at ${rating}A. It must be on a ${requiredAmps}A circuit.`,
      affectedInstanceIds: [instance.id, pdInstance.id],
      affectedConnectionIds: [conn.id],
    });
  }

  const sharedConnections = connectionsForPort(diagram, pdInstance.id, channel.id).filter(
    (c) => c.id !== conn.id,
  );
  if (sharedConnections.length > 0) {
    violations.push({
      ruleId: ruleIds.switchedOrShared,
      layer: 1,
      severity: "error",
      message: `${pdInstance.name}'s ${channel.name}, which powers ${instance.name}, is shared with ${sharedConnections.length} other connection(s). This circuit must not be shared with another load.`,
      affectedInstanceIds: [instance.id, pdInstance.id],
      affectedConnectionIds: [conn.id, ...sharedConnections.map((c) => c.id)],
    });
  }

  return violations;
}
