import type { DeviceLibrary } from "../library/loadLibrary.js";
import type { ExpandedDevice, Port, PortDirection } from "../types/device.js";
import type { DiagramProject } from "../types/diagram.js";
import {
  connectionsForPort,
  isPdOutputChannel,
  otherEnd,
  resolvePort,
  type ResolvedPort,
} from "./graph.js";
import type { Target } from "./types.js";

/**
 * Given a port the user has selected to start a wire, returns the set of
 * legal endpoints to connect it to. A target is legal if:
 *
 * - It is on a different instance (no self-connections).
 * - Its port type matches and its direction is compatible (not the same
 *   direction as the source — two outputs or two inputs can't be wired
 *   together; "bidirectional" is compatible with anything).
 * - Neither port is already connected to the other (no duplicate wires).
 * - The port hasn't already reached its maximum number of connections (a
 *   power input has at most one supply — except a PD's main power input,
 *   which legitimately takes two: the breaker-protected feed and the
 *   battery's direct return, per R609).
 * - Connecting would not put a second motor controller on a PD channel
 *   already feeding one (R621).
 */
export function getLegalTargets(
  instanceId: string,
  portId: string,
  diagram: DiagramProject,
  library: DeviceLibrary,
): Target[] {
  const source = resolvePort(diagram, library, { instanceId, portId });

  if (powerInputIsFull(diagram, source.device, source.instance.id, source.port)) {
    return [];
  }

  const existingPartners = new Set(
    connectionsForPort(diagram, instanceId, portId).map((conn) => {
      const other = otherEnd(conn, instanceId, portId);
      return `${other.instanceId}:${other.portId}`;
    }),
  );

  const targets: Target[] = [];

  for (const instance of diagram.instances) {
    if (instance.id === instanceId) continue;

    const device = library[instance.deviceId];
    if (!device) continue;

    for (const port of device.ports) {
      if (port.type !== source.port.type) continue;
      if (!directionsCompatible(source.port.direction, port.direction)) continue;
      if (existingPartners.has(`${instance.id}:${port.id}`)) continue;
      if (powerInputIsFull(diagram, device, instance.id, port)) continue;

      const target: ResolvedPort = { instance, device, port };
      if (createsSharedMotorControllerBreaker(diagram, library, source, target)) continue;

      targets.push({ instanceId: instance.id, portId: port.id });
    }
  }

  return targets;
}

/**
 * True if `port` is a power input that already has as many connections as it
 * can legally have. Ordinary power inputs accept at most one supply; a PD's
 * main power input accepts up to two (R609's breaker feed + battery return).
 */
function powerInputIsFull(
  diagram: DiagramProject,
  device: ExpandedDevice,
  instanceId: string,
  port: Port,
): boolean {
  if (port.type !== "power" || port.direction !== "input") return false;
  const maxConnections = device.category === "power-distribution" ? 2 : 1;
  return connectionsForPort(diagram, instanceId, port.id).length >= maxConnections;
}

/** True unless both directions are the same non-bidirectional direction (two outputs, or two inputs, can't be wired together). */
function directionsCompatible(a: PortDirection, b: PortDirection): boolean {
  if (a === "bidirectional" || b === "bidirectional") return true;
  return a !== b;
}

/**
 * True if connecting `a` and `b` would put a second motor controller on a PD
 * output channel that already powers one — R621 allows exactly one motor
 * controller per breaker.
 */
function createsSharedMotorControllerBreaker(
  diagram: DiagramProject,
  library: DeviceLibrary,
  a: ResolvedPort,
  b: ResolvedPort,
): boolean {
  const [pdSide, mcSide] = isPdOutputChannel(a.device, a.port)
    ? [a, b]
    : isPdOutputChannel(b.device, b.port)
      ? [b, a]
      : [];
  if (!pdSide || !mcSide) return false;
  if (
    mcSide.device.category !== "motor-controller" ||
    mcSide.port.type !== "power" ||
    mcSide.port.direction !== "input"
  ) {
    return false;
  }

  return connectionsForPort(diagram, pdSide.instance.id, pdSide.port.id).some((conn) => {
    const other = otherEnd(conn, pdSide.instance.id, pdSide.port.id);
    return resolvePort(diagram, library, other).device.category === "motor-controller";
  });
}
