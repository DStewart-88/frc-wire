import type { DeviceLibrary } from "../library/loadLibrary.js";
import type {
  Connection,
  DeviceInstance,
  DiagramProject,
  PortRef,
  Subsystem,
} from "../types/diagram.js";
import { isInteger, isNumber, isPlainObject, isString } from "../validator/guards.js";
import type { ValidationIssue } from "../validator/types.js";

export type DiagramValidationResult =
  | { success: true; diagram: DiagramProject }
  | { success: false; errors: ValidationIssue[] };

const REQUIRED_STRING_FIELDS = ["schemaVersion", "projectName"] as const;
const REQUIRED_INTEGER_FIELDS = ["teamNumber", "ruleYear"] as const;
const REQUIRED_ARRAY_FIELDS = ["subsystems", "instances", "connections"] as const;

/**
 * Validates a parsed diagram JSON value against the diagram model
 * (docs/phase-2-handoff.md section 4) and checks it for internal
 * consistency against the device library.
 *
 * This answers "is this a well-formed diagram file?" — it does not check
 * rule legality. That's the rules engine's job (src/rules), and requires
 * structural validity as a precondition.
 */
export function validateDiagramModel(
  data: unknown,
  library: DeviceLibrary,
): DiagramValidationResult {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(data)) {
    return { success: false, errors: [{ path: "", message: "Diagram must be a JSON object." }] };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!(field in data)) {
      errors.push({ path: field, message: `Missing required field "${field}".` });
    } else if (!isString(data[field])) {
      errors.push({ path: field, message: `Field "${field}" must be a string.` });
    }
  }

  for (const field of REQUIRED_INTEGER_FIELDS) {
    if (!(field in data)) {
      errors.push({ path: field, message: `Missing required field "${field}".` });
    } else if (!isInteger(data[field])) {
      errors.push({ path: field, message: `Field "${field}" must be an integer.` });
    }
  }

  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!(field in data)) {
      errors.push({ path: field, message: `Missing required field "${field}".` });
    } else if (!Array.isArray(data[field])) {
      errors.push({ path: field, message: `Field "${field}" must be an array.` });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const subsystems = (data.subsystems as unknown[])
    .map((s, i) => validateSubsystem(s, `subsystems[${i}]`, errors))
    .filter((s): s is Subsystem => s !== undefined);

  const instances = (data.instances as unknown[])
    .map((inst, i) => validateInstance(inst, `instances[${i}]`, errors, library))
    .filter((inst): inst is DeviceInstance => inst !== undefined);

  const connections = (data.connections as unknown[])
    .map((c, i) => validateConnection(c, `connections[${i}]`, errors))
    .filter((c): c is Connection => c !== undefined);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  checkUniqueIds(subsystems, "subsystems", errors);
  checkUniqueIds(instances, "instances", errors);
  checkUniqueIds(connections, "connections", errors);

  const subsystemIds = new Set(subsystems.map((s) => s.id));
  instances.forEach((inst, i) => {
    if (inst.subsystemId !== undefined && !subsystemIds.has(inst.subsystemId)) {
      errors.push({
        path: `instances[${i}].subsystemId`,
        message: `References unknown subsystem "${inst.subsystemId}".`,
      });
    }
  });

  const instanceById = new Map(instances.map((inst) => [inst.id, inst]));
  connections.forEach((conn, i) => {
    for (const [end, ref] of [
      ["from", conn.from],
      ["to", conn.to],
    ] as const) {
      const inst = instanceById.get(ref.instanceId);
      if (!inst) {
        errors.push({
          path: `connections[${i}].${end}.instanceId`,
          message: `References unknown instance "${ref.instanceId}".`,
        });
        continue;
      }

      const device = library[inst.deviceId];
      if (device && !device.ports.some((p) => p.id === ref.portId)) {
        errors.push({
          path: `connections[${i}].${end}.portId`,
          message: `Device "${inst.deviceId}" has no port "${ref.portId}".`,
        });
      }
    }
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    diagram: {
      schemaVersion: data.schemaVersion as string,
      projectName: data.projectName as string,
      teamNumber: data.teamNumber as number,
      ruleYear: data.ruleYear as number,
      subsystems,
      instances,
      connections,
    },
  };
}

function checkUniqueIds(
  items: { id: string }[],
  collectionPath: string,
  errors: ValidationIssue[],
): void {
  const seen = new Map<string, number>();
  for (const item of items) {
    seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
  }
  for (const [id, count] of seen) {
    if (count > 1) {
      errors.push({
        path: collectionPath,
        message: `Duplicate id "${id}" (${count} occurrences) in ${collectionPath}.`,
      });
    }
  }
}

function validateSubsystem(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): Subsystem | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: "Subsystem must be an object." });
    return undefined;
  }

  const id = requireString(value, "id", path, errors);
  const name = requireString(value, "name", path, errors);

  let color: string | undefined;
  if ("color" in value) {
    if (!isString(value.color)) {
      errors.push({ path: `${path}.color`, message: 'Field "color" must be a string.' });
    } else {
      color = value.color;
    }
  }

  if (id === undefined || name === undefined) return undefined;

  const subsystem: Subsystem = { id, name };
  if (color !== undefined) subsystem.color = color;
  return subsystem;
}

function validateInstance(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  library: DeviceLibrary,
): DeviceInstance | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: "Instance must be an object." });
    return undefined;
  }

  const id = requireString(value, "id", path, errors);
  const deviceId = requireString(value, "deviceId", path, errors);
  const name = requireString(value, "name", path, errors);

  if (deviceId !== undefined && !(deviceId in library)) {
    errors.push({
      path: `${path}.deviceId`,
      message: `Unknown deviceId "${deviceId}" — no such device in the library.`,
    });
  }

  let subsystemId: string | undefined;
  if ("subsystemId" in value) {
    if (!isString(value.subsystemId)) {
      errors.push({
        path: `${path}.subsystemId`,
        message: 'Field "subsystemId" must be a string.',
      });
    } else {
      subsystemId = value.subsystemId;
    }
  }

  let canId: number | undefined;
  if ("canId" in value) {
    if (!isInteger(value.canId)) {
      errors.push({ path: `${path}.canId`, message: 'Field "canId" must be an integer.' });
    } else {
      canId = value.canId;
    }
  }

  let properties: Record<string, boolean | string | number> | undefined;
  if ("properties" in value) {
    properties = validatePropertyValues(value.properties, `${path}.properties`, errors);
  }

  let portBreakers: Record<string, number> | undefined;
  if ("portBreakers" in value) {
    portBreakers = validatePortBreakers(
      value.portBreakers,
      `${path}.portBreakers`,
      errors,
      deviceId,
      library,
    );
  }

  let position: { x: number; y: number } | undefined;
  if ("position" in value) {
    position = validatePosition(value.position, `${path}.position`, errors);
  }

  if (id === undefined || deviceId === undefined || name === undefined) return undefined;

  const instance: DeviceInstance = { id, deviceId, name };
  if (subsystemId !== undefined) instance.subsystemId = subsystemId;
  if (canId !== undefined) instance.canId = canId;
  if (properties !== undefined) instance.properties = properties;
  if (portBreakers !== undefined) instance.portBreakers = portBreakers;
  if (position !== undefined) instance.position = position;
  return instance;
}

function validatePropertyValues(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): Record<string, boolean | string | number> | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "properties" must be an object.' });
    return undefined;
  }

  const result: Record<string, boolean | string | number> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val !== "boolean" && !isString(val) && !isNumber(val)) {
      errors.push({
        path: `${path}.${key}`,
        message: "Property value must be a boolean, string, or number.",
      });
    } else {
      result[key] = val;
    }
  }
  return result;
}

function validatePortBreakers(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  deviceId: string | undefined,
  library: DeviceLibrary,
): Record<string, number> | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "portBreakers" must be an object.' });
    return undefined;
  }

  const device = deviceId !== undefined ? library[deviceId] : undefined;
  const portIds = new Set(device?.ports.map((p) => p.id) ?? []);

  const result: Record<string, number> = {};
  for (const [portId, rating] of Object.entries(value)) {
    if (!isNumber(rating)) {
      errors.push({ path: `${path}.${portId}`, message: "Breaker rating must be a number." });
      continue;
    }
    if (device && !portIds.has(portId)) {
      errors.push({
        path: `${path}.${portId}`,
        message: `Device "${deviceId}" has no port "${portId}".`,
      });
      continue;
    }
    result[portId] = rating;
  }
  return result;
}

function validatePosition(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): { x: number; y: number } | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: 'Field "position" must be an object.' });
    return undefined;
  }

  let x: number | undefined;
  if (!("x" in value) || !isNumber(value.x)) {
    errors.push({ path: `${path}.x`, message: 'Field "x" is required and must be a number.' });
  } else {
    x = value.x;
  }

  let y: number | undefined;
  if (!("y" in value) || !isNumber(value.y)) {
    errors.push({ path: `${path}.y`, message: 'Field "y" is required and must be a number.' });
  } else {
    y = value.y;
  }

  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function validateConnection(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): Connection | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: "Connection must be an object." });
    return undefined;
  }

  const id = requireString(value, "id", path, errors);
  const from = "from" in value ? validatePortRef(value.from, `${path}.from`, errors) : undefined;
  const to = "to" in value ? validatePortRef(value.to, `${path}.to`, errors) : undefined;

  if (!("from" in value))
    errors.push({ path: `${path}.from`, message: 'Missing required field "from".' });
  if (!("to" in value))
    errors.push({ path: `${path}.to`, message: 'Missing required field "to".' });

  let wireGauge: number | undefined;
  if ("wireGauge" in value) {
    if (!isInteger(value.wireGauge)) {
      errors.push({
        path: `${path}.wireGauge`,
        message: 'Field "wireGauge" must be an integer (AWG).',
      });
    } else {
      wireGauge = value.wireGauge;
    }
  }

  let wireColor: string | undefined;
  if ("wireColor" in value) {
    if (!isString(value.wireColor)) {
      errors.push({ path: `${path}.wireColor`, message: 'Field "wireColor" must be a string.' });
    } else {
      wireColor = value.wireColor;
    }
  }

  let notes: string | undefined;
  if ("notes" in value) {
    if (!isString(value.notes)) {
      errors.push({ path: `${path}.notes`, message: 'Field "notes" must be a string.' });
    } else {
      notes = value.notes;
    }
  }

  if (id === undefined || from === undefined || to === undefined) return undefined;

  const connection: Connection = { id, from, to };
  if (wireGauge !== undefined) connection.wireGauge = wireGauge;
  if (wireColor !== undefined) connection.wireColor = wireColor;
  if (notes !== undefined) connection.notes = notes;
  return connection;
}

function validatePortRef(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): PortRef | undefined {
  if (!isPlainObject(value)) {
    errors.push({ path, message: "Connection endpoint must be an object." });
    return undefined;
  }

  const instanceId = requireString(value, "instanceId", path, errors);
  const portId = requireString(value, "portId", path, errors);

  if (instanceId === undefined || portId === undefined) return undefined;
  return { instanceId, portId };
}

/** Validates a required string field, pushing an error and returning undefined if missing or wrong type. */
function requireString(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationIssue[],
): string | undefined {
  if (!(field in obj)) {
    errors.push({ path: `${path}.${field}`, message: `Missing required field "${field}".` });
    return undefined;
  }
  if (!isString(obj[field])) {
    errors.push({ path: `${path}.${field}`, message: `Field "${field}" must be a string.` });
    return undefined;
  }
  return obj[field];
}
