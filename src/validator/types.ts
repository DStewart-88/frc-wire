import type { ExpandedDevice } from "../types/device.js";

/** A single validation error or warning, located by a JSON-path-like string. */
export interface ValidationIssue {
  /** Dot/bracket path to the offending field, e.g. "ports[2].voltage.min". */
  path: string;
  message: string;
}

export type ValidationResult =
  | { success: true; device: ExpandedDevice; warnings: ValidationIssue[] }
  | { success: false; errors: ValidationIssue[]; warnings: ValidationIssue[] };
