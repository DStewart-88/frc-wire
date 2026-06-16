import {
  DEVICE_CATEGORIES,
  type ExpandedDevice,
  type Port,
  type PortTemplate,
} from "../types/device.js";
import { expandPortTemplates } from "./expandTemplates.js";
import { isInteger, isPlainObject, isString } from "./guards.js";
import type { ValidationIssue, ValidationResult } from "./types.js";
import { validatePort, validatePortTemplate } from "./validatePort.js";
import { validateProperties } from "./validateProperties.js";

function validateBlockLayout(
  value: unknown,
  errors: ValidationIssue[],
): { width: number; height: number } | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path: "blockLayout", message: 'Field "blockLayout" must be an object.' });
    return undefined;
  }

  let width: number | undefined;
  let height: number | undefined;

  if (!("width" in value) || !isInteger(value.width) || (value.width as number) < 1) {
    errors.push({
      path: "blockLayout.width",
      message: 'Field "width" must be a positive integer.',
    });
  } else {
    width = value.width as number;
  }

  if (!("height" in value) || !isInteger(value.height) || (value.height as number) < 1) {
    errors.push({
      path: "blockLayout.height",
      message: 'Field "height" must be a positive integer.',
    });
  } else {
    height = value.height as number;
  }

  if (width === undefined || height === undefined) return undefined;
  return { width, height };
}

function validateLayoutRules(
  ports: Port[],
  blockLayout: { width: number; height: number } | undefined,
  errors: ValidationIssue[],
): void {
  const portsWithLayout = ports.filter((p) => p.layout !== undefined);
  if (portsWithLayout.length === 0) return;

  if (blockLayout === undefined) {
    errors.push({
      path: "blockLayout",
      message: "Device must declare blockLayout when any port declares a layout.",
    });
    return;
  }

  const sideOccupied = new Map<string, string>();

  for (const port of portsWithLayout) {
    const { side, order } = port.layout!;
    const bound = side === "left" || side === "right" ? blockLayout.height : blockLayout.width;

    if (order >= bound) {
      errors.push({
        path: "ports",
        message: `Port "${port.id}" layout order ${order} on side "${side}" exceeds block dimension ${bound}.`,
      });
    }

    const key = `${side}:${order}`;
    const existing = sideOccupied.get(key);
    if (existing !== undefined) {
      errors.push({
        path: "ports",
        message: `Ports "${existing}" and "${port.id}" share order ${order} on the "${side}" side.`,
      });
    } else {
      sideOccupied.set(key, port.id);
    }
  }
}

const REQUIRED_STRING_FIELDS = [
  "schemaVersion",
  "id",
  "name",
  "manufacturer",
  "partNumber",
  "category",
] as const;

/**
 * Validates a parsed device JSON value against the device library schema
 * (docs/device-library-schema.md), expanding any port templates.
 *
 * Returns either the validated, expanded device, or a list of errors. Either
 * way, any non-empty `note` fields are reported as warnings.
 */
export function validateDevice(data: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isPlainObject(data)) {
    errors.push({ path: "", message: "Device must be a JSON object." });
    return { success: false, errors, warnings };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!(field in data)) {
      errors.push({ path: field, message: `Missing required field "${field}".` });
    } else if (!isString(data[field])) {
      errors.push({ path: field, message: `Field "${field}" must be a string.` });
    }
  }

  if (
    isString(data.category) &&
    !(DEVICE_CATEGORIES as readonly string[]).includes(data.category)
  ) {
    errors.push({
      path: "category",
      message: `Invalid category "${data.category}". Must be one of: ${DEVICE_CATEGORIES.join(", ")}.`,
    });
  }

  if ("note" in data) {
    if (!isString(data.note)) {
      errors.push({ path: "note", message: 'Field "note" must be a string.' });
    } else if (data.note.trim() !== "") {
      warnings.push({
        path: "note",
        message: "Device has a non-empty note field — should be empty in production files.",
      });
    }
  }

  let blockLayout: { width: number; height: number } | undefined;
  if ("blockLayout" in data) {
    blockLayout = validateBlockLayout(data.blockLayout, errors);
  }

  let properties;
  if ("properties" in data) {
    properties = validateProperties(data.properties, errors);
  }

  const hasPorts = "ports" in data;
  const hasTemplates = "portTemplates" in data;

  if (!hasPorts && !hasTemplates) {
    errors.push({
      path: "",
      message: 'Device must define at least one of "ports" or "portTemplates".',
    });
  }

  let ports: Port[] = [];
  if (hasPorts) {
    if (!Array.isArray(data.ports)) {
      errors.push({ path: "ports", message: 'Field "ports" must be an array.' });
    } else {
      ports = data.ports
        .map((p, i) => validatePort(p, `ports[${i}]`, errors, warnings))
        .filter((p): p is Port => p !== undefined);
    }
  }

  let templates: PortTemplate[] = [];
  if (hasTemplates) {
    if (!Array.isArray(data.portTemplates)) {
      errors.push({ path: "portTemplates", message: 'Field "portTemplates" must be an array.' });
    } else {
      templates = data.portTemplates
        .map((t, i) => validatePortTemplate(t, `portTemplates[${i}]`, errors, warnings))
        .filter((t): t is PortTemplate => t !== undefined);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  const allPorts = [...ports, ...expandPortTemplates(templates)];

  if (allPorts.length === 0) {
    errors.push({
      path: "",
      message: "Device has no ports after template expansion — a device with no ports is invalid.",
    });
    return { success: false, errors, warnings };
  }

  const seen = new Map<string, number>();
  for (const port of allPorts) {
    seen.set(port.id, (seen.get(port.id) ?? 0) + 1);
  }
  for (const [id, count] of seen) {
    if (count > 1) {
      errors.push({
        path: "ports",
        message: `Duplicate port id "${id}" (${count} occurrences) after template expansion.`,
      });
    }
  }

  validateLayoutRules(allPorts, blockLayout, errors);

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  const device: ExpandedDevice = {
    schemaVersion: data.schemaVersion as string,
    id: data.id as string,
    name: data.name as string,
    manufacturer: data.manufacturer as string,
    partNumber: data.partNumber as string,
    category: data.category as ExpandedDevice["category"],
    ports: allPorts,
  };
  if (blockLayout !== undefined) device.blockLayout = blockLayout;
  if (properties !== undefined) device.properties = properties;
  if (isString(data.note)) device.note = data.note;

  return { success: true, device, warnings };
}
