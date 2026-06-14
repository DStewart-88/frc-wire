import { readFile } from "node:fs/promises";
import type { ValidationResult } from "./types.js";
import { validateDevice } from "./validateDevice.js";

/**
 * Loads a device JSON file from disk and validates it against the device
 * library schema.
 */
export async function loadDevice(filePath: string): Promise<ValidationResult> {
  const raw = await readFile(filePath, "utf-8");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [{ path: "", message: `Invalid JSON: ${message}` }],
      warnings: [],
    };
  }

  return validateDevice(data);
}
