import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDevice } from "../src/validator/loadDevice.js";

const devicesDir = path.join(import.meta.dirname, "..", "devices");
const deviceFiles = (await readdir(devicesDir)).filter((f) => f.endsWith(".json")).sort();

describe("device library", () => {
  it("contains the ten Phase 1 devices", () => {
    const ids = deviceFiles.map((f) => f.replace(/\.json$/, ""));

    expect(ids.sort()).toEqual(
      [
        "can-terminator",
        "ctre-pigeon-2",
        "eaton-cb285-120",
        "mk-es17-12",
        "ni-roborio-2",
        "rev-neo-v1-1",
        "rev-pdh",
        "rev-spark-max",
        "vh-109-radio",
        "wcp-kraken-x60",
      ].sort(),
    );
  });

  it.each(deviceFiles)("%s loads and validates successfully", async (file) => {
    const result = await loadDevice(path.join(devicesDir, file));
    if (!result.success) {
      throw new Error(
        `${file} failed validation:\n` +
          result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n"),
      );
    }
    expect(result.device.ports.length).toBeGreaterThan(0);
    expect(result.device.id).toBe(file.replace(/\.json$/, ""));
  });
});
