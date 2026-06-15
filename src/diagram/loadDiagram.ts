import { readFile } from "node:fs/promises";
import type { DeviceLibrary } from "../library/loadLibrary.js";
import { validateDiagramModel, type DiagramValidationResult } from "./validateDiagramModel.js";

/**
 * Loads a diagram project file from disk and validates it for structural
 * well-formedness against the device library.
 */
export async function loadDiagram(
  filePath: string,
  library: DeviceLibrary,
): Promise<DiagramValidationResult> {
  const raw = await readFile(filePath, "utf-8");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errors: [{ path: "", message: `Invalid JSON: ${message}` }] };
  }

  return validateDiagramModel(data, library);
}
