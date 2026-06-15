import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDiagram } from "../src/diagram/loadDiagram.js";
import { loadDeviceLibrary, type DeviceLibrary } from "../src/library/loadLibrary.js";

const devicesDir = path.join(import.meta.dirname, "..", "devices");
const fixturesDir = path.join(import.meta.dirname, "fixtures", "diagrams");
const malformedDir = path.join(fixturesDir, "malformed");

describe("loadDiagram", () => {
  let library: DeviceLibrary;

  beforeAll(async () => {
    library = await loadDeviceLibrary(devicesDir);
  });

  it("loads and validates a well-formed diagram", async () => {
    const result = await loadDiagram(path.join(fixturesDir, "minimal-valid.json"), library);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.diagram.projectName).toBe("Minimal Valid Robot");
      expect(result.diagram.instances).toHaveLength(7);
      expect(result.diagram.connections).toHaveLength(7);
    }
  });

  it("rejects a diagram that references an unknown device id", async () => {
    const result = await loadDiagram(path.join(malformedDir, "unknown-device.json"), library);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === "instances[0].deviceId")).toBe(true);
    }
  });

  it("rejects a nonexistent file", async () => {
    const result = await loadDiagram(path.join(fixturesDir, "does-not-exist.json"), library).catch(
      (e) => e,
    );
    expect(result).toBeInstanceOf(Error);
  });
});
