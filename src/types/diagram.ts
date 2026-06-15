/**
 * Types describing the diagram model — the saved state of one robot's wiring.
 * See docs/phase-2-handoff.md section 4 for the authoritative spec.
 *
 * Every instance, connection, and subsystem has a stable internal `id`
 * (a UUID) that is never shown to the user. Human-facing names are separate,
 * freely editable fields, and connections reference UUIDs so renaming
 * anything never breaks a reference.
 */

export interface Subsystem {
  id: string;
  name: string;
  color?: string;
}

/** One endpoint of a connection: a port on a specific device instance. */
export interface PortRef {
  instanceId: string;
  portId: string;
}

export interface DeviceInstance {
  id: string;
  /** References a device-library entry id, e.g. "rev-spark-max". */
  deviceId: string;
  name: string;
  /** References a Subsystem.id. Optional — a device need not be assigned. */
  subsystemId?: string;
  /** Only meaningful for devices that participate in CAN. */
  canId?: number;
  /** Instance values for device-level properties declared in the device library (e.g. canTermination). */
  properties?: Record<string, boolean | string | number>;
  /**
   * Per-port override of an installed breaker/fuse rating (amps), keyed by
   * port id. Only meaningful for power-distribution devices' output
   * channels. If a channel is not listed here, its rating defaults to that
   * port's `current.max` from the device library.
   */
  portBreakers?: Record<string, number>;
  /** Canvas coordinates. Unused until Phase 3; included now to avoid a later schema bump. */
  position?: { x: number; y: number };
}

export interface Connection {
  id: string;
  from: PortRef;
  to: PortRef;
  /** AWG. Optional at draw time, but required for a diagram to pass full validation — see R622. */
  wireGauge?: number;
  wireColor?: string;
  notes?: string;
}

export interface DiagramProject {
  /** Diagram-model schema version, for future migration. */
  schemaVersion: string;
  projectName: string;
  teamNumber: number;
  /** The ruleset this project validates against, e.g. 2026. */
  ruleYear: number;
  subsystems: Subsystem[];
  instances: DeviceInstance[];
  connections: Connection[];
}
