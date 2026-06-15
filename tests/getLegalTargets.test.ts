import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDiagram } from "../src/diagram/loadDiagram.js";
import { loadDeviceLibrary, type DeviceLibrary } from "../src/library/loadLibrary.js";
import { getLegalTargets } from "../src/rules/getLegalTargets.js";
import type { DiagramProject } from "../src/types/diagram.js";
import type { Target } from "../src/rules/types.js";

const devicesDir = path.join(import.meta.dirname, "..", "devices");
const fixturesDir = path.join(import.meta.dirname, "fixtures", "diagrams");

function byInstanceThenPort(a: Target, b: Target): number {
  return a.instanceId === b.instanceId
    ? a.portId.localeCompare(b.portId)
    : a.instanceId.localeCompare(b.instanceId);
}

describe("getLegalTargets", () => {
  let library: DeviceLibrary;
  let diagram: DiagramProject;

  beforeAll(async () => {
    library = await loadDeviceLibrary(devicesDir);
    const result = await loadDiagram(path.join(fixturesDir, "minimal-valid.json"), library);
    if (!result.success) throw new Error("minimal-valid.json failed to load");
    diagram = result.diagram;
  });

  it("offers every other CAN port on the bus as a target for a CAN port", () => {
    const targets = getLegalTargets("roborio-1", "can-1", diagram, library);

    expect([...targets].sort(byInstanceThenPort)).toEqual(
      [
        { instanceId: "pdh-1", portId: "can-1" },
        { instanceId: "pdh-1", portId: "can-2" },
        { instanceId: "sparkmax-1", portId: "can-1" },
        { instanceId: "sparkmax-1", portId: "can-2" },
      ].sort(byInstanceThenPort),
    );
  });

  it("offers no targets for a power input that already has its one supply", () => {
    expect(getLegalTargets("roborio-1", "power-in", diagram, library)).toEqual([]);
  });

  it("does not offer a PD channel already feeding a motor controller to another motor controller, or vice versa", () => {
    const adHoc: DiagramProject = {
      schemaVersion: "1.0",
      projectName: "Ad Hoc",
      teamNumber: 1234,
      ruleYear: 2026,
      subsystems: [],
      instances: [
        { id: "pdh-1", deviceId: "rev-pdh", name: "PDH" },
        { id: "sparkmax-1", deviceId: "rev-spark-max", name: "SPARK MAX 1" },
        { id: "sparkmax-2", deviceId: "rev-spark-max", name: "SPARK MAX 2" },
      ],
      connections: [
        {
          id: "conn-1",
          from: { instanceId: "pdh-1", portId: "hc-0" },
          to: { instanceId: "sparkmax-1", portId: "power-in" },
        },
      ],
    };

    expect(getLegalTargets("pdh-1", "hc-0", adHoc, library)).not.toContainEqual({
      instanceId: "sparkmax-2",
      portId: "power-in",
    });

    expect(getLegalTargets("sparkmax-2", "power-in", adHoc, library)).not.toContainEqual({
      instanceId: "pdh-1",
      portId: "hc-0",
    });
  });
});
