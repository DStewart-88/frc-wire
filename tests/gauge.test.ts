import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDiagram } from "../src/diagram/loadDiagram.js";
import { loadDeviceLibrary, type DeviceLibrary } from "../src/library/loadLibrary.js";
import { deriveMinimumWireGauge, minimumGaugeForProtection } from "../src/rules/gauge.js";
import type { DiagramProject } from "../src/types/diagram.js";

const devicesDir = path.join(import.meta.dirname, "..", "devices");
const fixturesDir = path.join(import.meta.dirname, "fixtures", "diagrams");

describe("minimumGaugeForProtection", () => {
  it.each([
    [10, 18],
    [20, 18],
    [25, 14],
    [30, 14],
    [40, 12],
    [120, 6],
  ])("returns %i AWG minimum for a %iA breaker (Table 8-4)", (amps, expected) => {
    expect(minimumGaugeForProtection(amps)).toBe(expected);
  });

  it("returns undefined for a protection level above Table 8-4's range", () => {
    expect(minimumGaugeForProtection(150)).toBeUndefined();
  });
});

describe("deriveMinimumWireGauge", () => {
  let library: DeviceLibrary;
  let diagram: DiagramProject;

  beforeAll(async () => {
    library = await loadDeviceLibrary(devicesDir);
    const result = await loadDiagram(path.join(fixturesDir, "minimal-valid.json"), library);
    if (!result.success) throw new Error("minimal-valid.json failed to load");
    diagram = result.diagram;
  });

  it("derives 6 AWG for a connection on the 120A main chain", () => {
    const conn = diagram.connections.find((c) => c.id === "conn-batt-pos-to-breaker")!;
    expect(deriveMinimumWireGauge(diagram, library, conn)).toBe(6);
  });

  it("derives 6 AWG for the battery's direct return to the PD", () => {
    const conn = diagram.connections.find((c) => c.id === "conn-batt-neg-to-pdh")!;
    expect(deriveMinimumWireGauge(diagram, library, conn)).toBe(6);
  });

  it("derives 18 AWG for a connection on a 10A PD channel", () => {
    const conn = diagram.connections.find((c) => c.id === "conn-pdh-to-roborio")!;
    expect(deriveMinimumWireGauge(diagram, library, conn)).toBe(18);
  });

  it("returns undefined for a connection with no determinable protection level", () => {
    const conn = diagram.connections.find((c) => c.id === "conn-sparkmax-to-neo")!;
    expect(deriveMinimumWireGauge(diagram, library, conn)).toBeUndefined();
  });
});
