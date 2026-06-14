import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDevice } from "../src/validator/loadDevice.js";

const fixturesDir = path.join(import.meta.dirname, "fixtures");
const malformedDir = path.join(fixturesDir, "malformed");

describe("loadDevice", () => {
  it("loads and validates a well-formed device file", async () => {
    const result = await loadDevice(path.join(fixturesDir, "valid-device.json"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.device.id).toBe("test-device");
      expect(result.device.ports.map((p) => p.id)).toEqual(["power-in", "can"]);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("expands portTemplates when loading from disk", async () => {
    const result = await loadDevice(path.join(fixturesDir, "template-device.json"));
    expect(result.success).toBe(true);
    if (result.success) {
      const ids = result.device.ports.map((p) => p.id);
      expect(ids).toEqual(["power-in", "ch-1", "ch-2", "ch-3"]);
    }
  });

  it.each([
    ["missing-required-field.json", "id"],
    ["invalid-category.json", "category"],
    ["no-ports.json", ""],
    ["malformed-template.json", "portTemplates[0].indexStart"],
    ["invalid-port-type.json", "ports[0].type"],
    ["duplicate-port-ids.json", "ports"],
  ])("rejects %s with an error on %s", async (file, path_) => {
    const result = await loadDevice(path.join(malformedDir, file));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === path_)).toBe(true);
    }
  });

  it("returns an error for invalid JSON", async () => {
    const result = await loadDevice(path.join(fixturesDir, "does-not-exist.json")).catch((e) => e);
    expect(result).toBeInstanceOf(Error);
  });
});
