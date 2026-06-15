import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDiagram } from "../src/diagram/loadDiagram.js";
import { loadDeviceLibrary, type DeviceLibrary } from "../src/library/loadLibrary.js";
import { validateDiagram } from "../src/rules/validateDiagram.js";
import type { DiagramProject } from "../src/types/diagram.js";

const devicesDir = path.join(import.meta.dirname, "..", "devices");
const fixturesDir = path.join(import.meta.dirname, "fixtures", "diagrams");

async function loadFixture(name: string, library: DeviceLibrary): Promise<DiagramProject> {
  const result = await loadDiagram(path.join(fixturesDir, name), library);
  if (!result.success) {
    throw new Error(
      `Fixture ${name} failed structural validation: ${JSON.stringify(result.errors)}`,
    );
  }
  return result.diagram;
}

describe("validateDiagram", () => {
  let library: DeviceLibrary;

  beforeAll(async () => {
    library = await loadDeviceLibrary(devicesDir);
  });

  it("returns no violations for the minimal valid robot", async () => {
    const diagram = await loadFixture("minimal-valid.json", library);
    expect(validateDiagram(diagram, library)).toEqual([]);
  });

  it("returns exactly the expected violations for the known-violations robot", async () => {
    const diagram = await loadFixture("known-violations.json", library);
    const violations = validateDiagram(diagram, library);

    const summary = violations
      .map((v) => ({ ruleId: v.ruleId, layer: v.layer, severity: v.severity }))
      .sort((a, b) => `${a.ruleId}-${a.severity}`.localeCompare(`${b.ruleId}-${b.severity}`));

    // roboRIO on a switchable, wrong-amperage channel (R615 x2); two motor
    // controllers sharing one PD channel (R621); that shared channel's wire
    // too thin for its breaker (R622 error); the battery return wire with no
    // gauge recorded (R622 incomplete).
    expect(summary).toEqual([
      { ruleId: "R615", layer: 1, severity: "error" },
      { ruleId: "R615", layer: 1, severity: "error" },
      { ruleId: "R621", layer: 1, severity: "error" },
      { ruleId: "R622", layer: 1, severity: "error" },
      { ruleId: "R622", layer: 1, severity: "incomplete" },
    ]);

    const r615 = violations.filter((v) => v.ruleId === "R615");
    expect(r615.every((v) => v.affectedInstanceIds.includes("roborio-1"))).toBe(true);

    const r621 = violations.find((v) => v.ruleId === "R621")!;
    expect(r621.affectedConnectionIds.sort()).toEqual([
      "conn-pdh-to-kraken",
      "conn-pdh-to-sparkmax",
    ]);

    const r622Error = violations.find((v) => v.ruleId === "R622" && v.severity === "error")!;
    expect(r622Error.affectedConnectionIds).toEqual(["conn-pdh-to-kraken"]);

    const r622Incomplete = violations.find(
      (v) => v.ruleId === "R622" && v.severity === "incomplete",
    )!;
    expect(r622Incomplete.affectedConnectionIds).toEqual(["conn-batt-neg-to-pdh"]);
  });
});
