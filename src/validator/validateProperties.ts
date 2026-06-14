import { PROPERTY_TYPES, type PropertyDefinition } from "../types/device.js";
import { isBoolean, isNumber, isPlainObject, isString } from "./guards.js";
import type { ValidationIssue } from "./types.js";

/** Validates the device-level `properties` object (schema section 6). */
export function validateProperties(
  value: unknown,
  errors: ValidationIssue[],
): Record<string, PropertyDefinition> | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path: "properties", message: 'Field "properties" must be an object.' });
    return undefined;
  }

  const result: Record<string, PropertyDefinition> = {};

  for (const [key, def] of Object.entries(value)) {
    const path = `properties.${key}`;

    if (!isPlainObject(def)) {
      errors.push({ path, message: "Property definition must be an object." });
      continue;
    }

    let type: PropertyDefinition["type"] | undefined;
    if (!("type" in def)) {
      errors.push({ path: `${path}.type`, message: 'Missing required field "type".' });
    } else if (!isString(def.type) || !(PROPERTY_TYPES as readonly string[]).includes(def.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid property type "${String(def.type)}". Must be one of: ${PROPERTY_TYPES.join(", ")}.`,
      });
    } else {
      type = def.type as PropertyDefinition["type"];
    }

    let label: string | undefined;
    if (!("label" in def)) {
      errors.push({ path: `${path}.label`, message: 'Missing required field "label".' });
    } else if (!isString(def.label)) {
      errors.push({ path: `${path}.label`, message: 'Field "label" must be a string.' });
    } else {
      label = def.label;
    }

    if (!("default" in def)) {
      errors.push({ path: `${path}.default`, message: 'Missing required field "default".' });
    } else if (type !== undefined && !matchesType(def.default, type)) {
      errors.push({
        path: `${path}.default`,
        message: `Field "default" must match declared type "${type}".`,
      });
    }

    if (type !== undefined && label !== undefined && "default" in def) {
      result[key] = { type, label, default: def.default as PropertyDefinition["default"] };
    }
  }

  return result;
}

function matchesType(value: unknown, type: PropertyDefinition["type"]): boolean {
  switch (type) {
    case "boolean":
      return isBoolean(value);
    case "string":
      return isString(value);
    case "number":
      return isNumber(value);
  }
}
