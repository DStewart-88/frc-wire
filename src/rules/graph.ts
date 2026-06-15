/**
 * Graph-traversal helpers shared by rule implementations. These walk the
 * (devices, connections) graph formed by a diagram and its device library —
 * pure functions, no side effects.
 */
import type { DeviceLibrary } from "../library/loadLibrary.js";
import type { ExpandedDevice, Port } from "../types/device.js";
import type { Connection, DeviceInstance, DiagramProject, PortRef } from "../types/diagram.js";

export interface ResolvedPort {
  instance: DeviceInstance;
  device: ExpandedDevice;
  port: Port;
}

/**
 * Resolves a port reference to its instance, device definition, and port
 * definition. Assumes `diagram` has already passed `validateDiagramModel`
 * against `library`, so every reference is known to resolve.
 */
export function resolvePort(
  diagram: DiagramProject,
  library: DeviceLibrary,
  ref: PortRef,
): ResolvedPort {
  const instance = diagram.instances.find((i) => i.id === ref.instanceId);
  if (!instance) throw new Error(`Unknown instance "${ref.instanceId}".`);

  const device = library[instance.deviceId];
  if (!device) throw new Error(`Unknown device "${instance.deviceId}".`);

  const port = device.ports.find((p) => p.id === ref.portId);
  if (!port) throw new Error(`Device "${instance.deviceId}" has no port "${ref.portId}".`);

  return { instance, device, port };
}

/** All instances whose device belongs to the given library category. */
export function instancesByCategory(
  diagram: DiagramProject,
  library: DeviceLibrary,
  category: ExpandedDevice["category"],
): DeviceInstance[] {
  return diagram.instances.filter((inst) => library[inst.deviceId]?.category === category);
}

/** All connections with at least one endpoint at (instanceId, portId). */
export function connectionsForPort(
  diagram: DiagramProject,
  instanceId: string,
  portId: string,
): Connection[] {
  return diagram.connections.filter(
    (c) =>
      (c.from.instanceId === instanceId && c.from.portId === portId) ||
      (c.to.instanceId === instanceId && c.to.portId === portId),
  );
}

/** The endpoint of `connection` that is not (instanceId, portId). */
export function otherEnd(connection: Connection, instanceId: string, portId: string): PortRef {
  if (connection.from.instanceId === instanceId && connection.from.portId === portId) {
    return connection.to;
  }
  return connection.from;
}

/** The connection directly between ports `a` and `b` (in either direction), if one exists. */
export function directConnection(
  diagram: DiagramProject,
  a: PortRef,
  b: PortRef,
): Connection | undefined {
  return diagram.connections.find((c) => {
    const matches = (x: PortRef, y: PortRef) =>
      x.instanceId === y.instanceId && x.portId === y.portId;
    return (matches(c.from, a) && matches(c.to, b)) || (matches(c.from, b) && matches(c.to, a));
  });
}

/** True if `port` is one of a power-distribution device's protected output channels. */
export function isPdOutputChannel(device: ExpandedDevice, port: Port): boolean {
  return (
    device.category === "power-distribution" && port.type === "power" && port.direction === "output"
  );
}

/**
 * The breaker/fuse rating (amps) protecting a power-distribution output
 * channel: the instance's recorded override (`portBreakers`) if present,
 * otherwise the port's rated maximum current from the device library.
 */
export function getChannelBreakerRating(instance: DeviceInstance, port: Port): number {
  return instance.portBreakers?.[port.id] ?? port.current?.max ?? 0;
}

/**
 * The breaker/fuse rating (amps) protecting `connection`, or undefined if
 * neither endpoint is a protection point the rules engine understands. Used
 * by R622 and its gauge-derivation helper to find "the protection level for
 * this circuit":
 *
 * - A branch circuit (one endpoint is a PD output channel) is protected at
 *   that channel's breaker rating.
 * - A main-chain connection (an endpoint on the main breaker, or on the PD's
 *   main power input — the battery's direct return path) is protected at
 *   the main breaker's rated current.
 */
export function getProtectionRating(
  diagram: DiagramProject,
  library: DeviceLibrary,
  connection: Connection,
): number | undefined {
  for (const ref of [connection.from, connection.to]) {
    const { instance, device, port } = resolvePort(diagram, library, ref);
    if (isPdOutputChannel(device, port)) {
      return getChannelBreakerRating(instance, port);
    }
  }

  for (const ref of [connection.from, connection.to]) {
    const { device, port } = resolvePort(diagram, library, ref);

    if (device.category === "protection" && port.type === "power" && port.current) {
      return port.current.max;
    }

    if (
      device.category === "power-distribution" &&
      port.type === "power" &&
      port.direction === "input"
    ) {
      const mainBreakerRating = mainBreakerCurrentRating(diagram, library);
      if (mainBreakerRating !== undefined) return mainBreakerRating;
    }
  }

  return undefined;
}

/** The rated current (amps) of the diagram's main breaker, if exactly one exists with a rated power port. */
function mainBreakerCurrentRating(
  diagram: DiagramProject,
  library: DeviceLibrary,
): number | undefined {
  const breaker = instancesByCategory(diagram, library, "protection")[0];
  if (!breaker) return undefined;

  const ratedPort = library[breaker.deviceId]!.ports.find((p) => p.type === "power" && p.current);
  return ratedPort?.current?.max;
}
