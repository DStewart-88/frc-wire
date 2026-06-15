import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ExpandedDevice } from "../types/device.js";
import { loadDevice } from "../validator/loadDevice.js";

/** The device library, keyed by device id (e.g. "rev-spark-max"). */
export type DeviceLibrary = Record<string, ExpandedDevice>;

/**
 * Loads every device file in `devicesDir` and returns them keyed by device
 * id, with portTemplates expanded. This is the library the diagram loader
 * and rules engine validate diagrams against.
 *
 * Throws if any device file fails Phase 1 schema validation — the rules
 * engine assumes a clean, validated library.
 */
export async function loadDeviceLibrary(devicesDir: string): Promise<DeviceLibrary> {
  const files = (await readdir(devicesDir)).filter((f) => f.endsWith(".json"));

  const library: DeviceLibrary = {};
  for (const file of files) {
    const result = await loadDevice(path.join(devicesDir, file));
    if (!result.success) {
      throw new Error(
        `Device file ${file} failed validation:\n` +
          result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n"),
      );
    }
    library[result.device.id] = result.device;
  }

  return library;
}
