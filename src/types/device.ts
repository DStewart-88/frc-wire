/**
 * Types describing the device library JSON schema.
 * See docs/device-library-schema.md for the authoritative spec.
 */

export const PORT_LAYOUT_SIDES = ["left", "right", "top", "bottom"] as const;
export type PortLayoutSide = (typeof PORT_LAYOUT_SIDES)[number];

export interface PortLayout {
  side: PortLayoutSide;
  order: number;
}

export const DEVICE_CATEGORIES = [
  "robot-controller",
  "power-distribution",
  "motor-controller",
  "motor",
  "sensor",
  "camera",
  "coprocessor",
  "networking",
  "regulator",
  "battery",
  "protection",
  "termination",
  "other",
] as const;

export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

/** Port types per docs/device-library-schema.md section 7.2. */
export const PORT_TYPES = [
  "power",
  "motor",
  "can",
  "pwm",
  "dio",
  "analog-in",
  "relay",
  "ethernet",
  "usb-a",
  "usb-b",
  "mxp",
  "data",
  "sensor",
] as const;

export type PortType = (typeof PORT_TYPES)[number];

export const PORT_DIRECTIONS = ["input", "output", "bidirectional"] as const;

export type PortDirection = (typeof PORT_DIRECTIONS)[number];

export const PROPERTY_TYPES = ["boolean", "string", "number"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface VoltageRange {
  min?: number;
  max?: number;
  nominal?: number;
}

export interface WireGaugeRange {
  min: number;
  max: number;
}

export interface CurrentSpec {
  max: number;
}

/** Fields shared by a concrete port and a port template. */
export interface PortBase {
  name: string;
  type: PortType;
  direction: PortDirection;
  voltage?: VoltageRange;
  wireGauge?: WireGaugeRange;
  current?: CurrentSpec;
  connector: string | null;
  switchable?: boolean;
  layout?: PortLayout;
  note?: string;
}

export interface Port extends PortBase {
  id: string;
}

export interface PortTemplate extends PortBase {
  id: string;
  count: number;
  indexStart: number;
}

export interface PropertyDefinition {
  type: PropertyType;
  default: boolean | string | number;
  label: string;
}

export interface DeviceDefinition {
  schemaVersion: string;
  id: string;
  name: string;
  manufacturer: string;
  partNumber: string;
  category: DeviceCategory;
  blockLayout?: { width: number; height: number };
  properties?: Record<string, PropertyDefinition>;
  ports?: Port[];
  portTemplates?: PortTemplate[];
  note?: string;
}

/** A device definition after portTemplates have been expanded into `ports`. */
export interface ExpandedDevice extends Omit<DeviceDefinition, "portTemplates"> {
  ports: Port[];
}
