import {
  PORT_DIRECTIONS,
  PORT_LAYOUT_SIDES,
  PORT_TYPES,
  type CurrentSpec,
  type Port,
  type PortBase,
  type PortLayout,
  type PortLayoutSide,
  type PortTemplate,
  type VoltageRange,
  type WireGaugeRange,
} from "../types/device.js";
import { isBoolean, isInteger, isNumber, isPlainObject, isString } from "./guards.js";
import type { ValidationIssue } from "./types.js";

/** Validates fields shared by a concrete port and a port template. */
function validatePortBase(
  obj: Record<string, unknown>,
  path: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): PortBase {
  const base: PortBase = {
    name: "",
    type: "power",
    direction: "input",
    connector: null,
  };

  if (!("name" in obj)) {
    errors.push({ path: `${path}.name`, message: 'Missing required field "name".' });
  } else if (!isString(obj.name)) {
    errors.push({ path: `${path}.name`, message: 'Field "name" must be a string.' });
  } else {
    base.name = obj.name;
  }

  if (!("type" in obj)) {
    errors.push({ path: `${path}.type`, message: 'Missing required field "type".' });
  } else if (!isString(obj.type) || !(PORT_TYPES as readonly string[]).includes(obj.type)) {
    errors.push({
      path: `${path}.type`,
      message: `Invalid port type "${String(obj.type)}". Must be one of: ${PORT_TYPES.join(", ")}.`,
    });
  } else {
    base.type = obj.type as PortBase["type"];
  }

  if (!("direction" in obj)) {
    errors.push({ path: `${path}.direction`, message: 'Missing required field "direction".' });
  } else if (
    !isString(obj.direction) ||
    !(PORT_DIRECTIONS as readonly string[]).includes(obj.direction)
  ) {
    errors.push({
      path: `${path}.direction`,
      message: `Invalid direction "${String(obj.direction)}". Must be one of: ${PORT_DIRECTIONS.join(", ")}.`,
    });
  } else {
    base.direction = obj.direction as PortBase["direction"];
  }

  if (!("connector" in obj)) {
    errors.push({ path: `${path}.connector`, message: 'Missing required field "connector".' });
  } else if (obj.connector !== null && !isString(obj.connector)) {
    errors.push({
      path: `${path}.connector`,
      message: 'Field "connector" must be a string or null.',
    });
  } else {
    base.connector = obj.connector;
  }

  if ("voltage" in obj) {
    const voltage = validateVoltage(obj.voltage, `${path}.voltage`, errors);
    if (voltage) base.voltage = voltage;
  }

  if ("wireGauge" in obj) {
    const wireGauge = validateWireGauge(obj.wireGauge, `${path}.wireGauge`, errors);
    if (wireGauge) base.wireGauge = wireGauge;
  }

  if ("current" in obj) {
    const current = validateCurrent(obj.current, `${path}.current`, errors);
    if (current) base.current = current;
  }

  if ("switchable" in obj) {
    if (!isBoolean(obj.switchable)) {
      errors.push({
        path: `${path}.switchable`,
        message: 'Field "switchable" must be a boolean.',
      });
    } else {
      base.switchable = obj.switchable;
    }
  }

  if ("layout" in obj) {
    const layout = validatePortLayout(obj.layout, `${path}.layout`, errors);
    if (layout) base.layout = layout;
  }

  if ("note" in obj) {
    if (!isString(obj.note)) {
      errors.push({ path: `${path}.note`, message: 'Field "note" must be a string.' });
    } else {
      base.note = obj.note;
      if (obj.note.trim() !== "") {
        warnings.push({
          path: `${path}.note`,
          message: "Port has a non-empty note field — should be empty in production files.",
        });
      }
    }
  }

  return base;
}

function validatePortLayout(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): PortLayout | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "layout" must be an object.' });
    return undefined;
  }

  let side: PortLayoutSide | undefined;
  if (!("side" in value)) {
    errors.push({ path: `${path}.side`, message: 'Missing required field "side".' });
  } else if (
    !isString(value.side) ||
    !(PORT_LAYOUT_SIDES as readonly string[]).includes(value.side)
  ) {
    errors.push({
      path: `${path}.side`,
      message: `Invalid side "${String(value.side)}". Must be one of: ${PORT_LAYOUT_SIDES.join(", ")}.`,
    });
  } else {
    side = value.side as PortLayoutSide;
  }

  let order: number | undefined;
  if (!("order" in value)) {
    errors.push({ path: `${path}.order`, message: 'Missing required field "order".' });
  } else if (!isInteger(value.order) || (value.order as number) < 0) {
    errors.push({
      path: `${path}.order`,
      message: 'Field "order" must be a non-negative integer.',
    });
  } else {
    order = value.order as number;
  }

  if (side === undefined || order === undefined) return undefined;
  return { side, order };
}

function validateVoltage(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): VoltageRange | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "voltage" must be an object.' });
    return undefined;
  }

  const voltage: VoltageRange = {};
  for (const field of ["min", "max", "nominal"] as const) {
    if (field in value) {
      if (!isNumber(value[field])) {
        errors.push({ path: `${path}.${field}`, message: `Field "${field}" must be a number.` });
      } else {
        voltage[field] = value[field];
      }
    }
  }

  if (voltage.min !== undefined && voltage.max !== undefined && voltage.min > voltage.max) {
    errors.push({
      path,
      message: `voltage.min (${voltage.min}) must not be greater than voltage.max (${voltage.max}).`,
    });
  }

  return voltage;
}

function validateWireGauge(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): WireGaugeRange | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "wireGauge" must be an object.' });
    return undefined;
  }

  let min: number | undefined;
  let max: number | undefined;

  if (!("min" in value) || !isNumber(value.min)) {
    errors.push({ path: `${path}.min`, message: 'Field "min" is required and must be a number.' });
  } else {
    min = value.min;
  }

  if (!("max" in value) || !isNumber(value.max)) {
    errors.push({ path: `${path}.max`, message: 'Field "max" is required and must be a number.' });
  } else {
    max = value.max;
  }

  if (min === undefined || max === undefined) return undefined;
  return { min, max };
}

function validateCurrent(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): CurrentSpec | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "current" must be an object.' });
    return undefined;
  }

  if (!("max" in value) || !isNumber(value.max)) {
    errors.push({ path: `${path}.max`, message: 'Field "max" is required and must be a number.' });
    return undefined;
  }

  return { max: value.max };
}

/** Validates an entry of the device's `ports` array. */
export function validatePort(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): Port | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: "Port must be an object." });
    return undefined;
  }

  let id: string | undefined;
  if (!("id" in value)) {
    errors.push({ path: `${path}.id`, message: 'Missing required field "id".' });
  } else if (!isString(value.id)) {
    errors.push({ path: `${path}.id`, message: 'Field "id" must be a string.' });
  } else {
    id = value.id;
  }

  const base = validatePortBase(value, path, errors, warnings);

  if (id === undefined) return undefined;
  return { id, ...base };
}

/** Validates an entry of the device's `portTemplates` array. */
export function validatePortTemplate(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): PortTemplate | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: "Port template must be an object." });
    return undefined;
  }

  let id: string | undefined;
  if (!("id" in value)) {
    errors.push({ path: `${path}.id`, message: 'Missing required field "id".' });
  } else if (!isString(value.id)) {
    errors.push({ path: `${path}.id`, message: 'Field "id" must be a string.' });
  } else if (!value.id.includes("{n}")) {
    errors.push({
      path: `${path}.id`,
      message: 'Template "id" must contain the "{n}" placeholder.',
    });
  } else {
    id = value.id;
  }

  const base = validatePortBase(value, path, errors, warnings);

  if (base.name && !base.name.includes("{n}")) {
    errors.push({
      path: `${path}.name`,
      message: 'Template "name" must contain the "{n}" placeholder.',
    });
  }

  let count: number | undefined;
  if (!("count" in value)) {
    errors.push({ path: `${path}.count`, message: 'Missing required field "count".' });
  } else if (!isInteger(value.count) || value.count < 1) {
    errors.push({ path: `${path}.count`, message: 'Field "count" must be a positive integer.' });
  } else {
    count = value.count;
  }

  let indexStart: number | undefined;
  if (!("indexStart" in value)) {
    errors.push({ path: `${path}.indexStart`, message: 'Missing required field "indexStart".' });
  } else if (!isInteger(value.indexStart) || value.indexStart < 0) {
    errors.push({
      path: `${path}.indexStart`,
      message: 'Field "indexStart" must be a non-negative integer.',
    });
  } else {
    indexStart = value.indexStart;
  }

  if (id === undefined || count === undefined || indexStart === undefined) return undefined;
  return { id, count, indexStart, ...base };
}
