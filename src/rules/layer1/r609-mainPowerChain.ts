import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { Connection, DiagramProject } from "../../types/diagram.js";
import { directConnection, instancesByCategory } from "../graph.js";
import type { Violation } from "../types.js";

/**
 * R609 (2026): the main power chain must be battery -> a single 120A main
 * breaker -> a single power distribution device (PD). Battery positive
 * routes through the main breaker to the PD's main power input; battery
 * negative routes directly to the PD, not through the breaker. Exactly one
 * battery, one main breaker, and one PD.
 */
export function checkMainPowerChain(diagram: DiagramProject, library: DeviceLibrary): Violation[] {
  const violations: Violation[] = [];

  const batteries = instancesByCategory(diagram, library, "battery");
  const breakers = instancesByCategory(diagram, library, "protection");
  const pds = instancesByCategory(diagram, library, "power-distribution");

  pushCardinalityError(violations, batteries, "battery", "battery");
  pushCardinalityError(violations, breakers, "main breaker", "main breaker");
  pushCardinalityError(violations, pds, "power distribution device", "power distribution device");

  if (batteries.length !== 1 || breakers.length !== 1 || pds.length !== 1) {
    // Topology can only be checked when exactly one of each is present.
    return violations;
  }

  const battery = batteries[0]!;
  const breaker = breakers[0]!;
  const pd = pds[0]!;

  const batteryOutputs = library[battery.deviceId]!.ports.filter(
    (p) => p.type === "power" && p.direction === "output",
  );
  const breakerInput = library[breaker.deviceId]!.ports.find(
    (p) => p.type === "power" && p.direction === "input",
  );
  const breakerOutput = library[breaker.deviceId]!.ports.find(
    (p) => p.type === "power" && p.direction === "output",
  );
  const pdInput = library[pd.deviceId]!.ports.find(
    (p) => p.type === "power" && p.direction === "input",
  );

  if (!breakerInput || !breakerOutput || !pdInput) {
    return violations;
  }

  let batteryToBreaker: Connection | undefined;
  let breakerSourcePortId: string | undefined;
  for (const bp of batteryOutputs) {
    const conn = directConnection(
      diagram,
      { instanceId: battery.id, portId: bp.id },
      { instanceId: breaker.id, portId: breakerInput.id },
    );
    if (conn) {
      batteryToBreaker = conn;
      breakerSourcePortId = bp.id;
      break;
    }
  }

  const breakerToPd = directConnection(
    diagram,
    { instanceId: breaker.id, portId: breakerOutput.id },
    { instanceId: pd.id, portId: pdInput.id },
  );

  let batteryToPd: Connection | undefined;
  for (const bp of batteryOutputs) {
    if (bp.id === breakerSourcePortId) continue;
    const conn = directConnection(
      diagram,
      { instanceId: battery.id, portId: bp.id },
      { instanceId: pd.id, portId: pdInput.id },
    );
    if (conn) {
      batteryToPd = conn;
      break;
    }
  }

  const missing: string[] = [];
  if (!batteryToBreaker) missing.push("battery to main breaker");
  if (!breakerToPd) missing.push("main breaker to power distribution device");
  if (!batteryToPd) missing.push("battery directly to power distribution device (return path)");

  if (missing.length > 0) {
    violations.push({
      ruleId: "R609",
      layer: 1,
      severity: "error",
      message:
        `Main power chain is incomplete or incorrect: missing ${missing.join("; ")}. ` +
        "Expected battery -> main breaker -> PD main power input, with the battery's other terminal wired directly to the PD.",
      affectedInstanceIds: [battery.id, breaker.id, pd.id],
      affectedConnectionIds: [batteryToBreaker, breakerToPd, batteryToPd]
        .filter((c): c is Connection => c !== undefined)
        .map((c) => c.id),
    });
  }

  return violations;
}

function pushCardinalityError(
  violations: Violation[],
  instances: { id: string }[],
  noneMessage: string,
  manyMessage: string,
): void {
  if (instances.length === 1) return;

  violations.push({
    ruleId: "R609",
    layer: 1,
    severity: "error",
    message:
      instances.length === 0
        ? `No ${noneMessage} found. The main power chain requires exactly one.`
        : `${instances.length} ${manyMessage}s found. The main power chain requires exactly one.`,
    affectedInstanceIds: instances.map((i) => i.id),
    affectedConnectionIds: [],
  });
}
