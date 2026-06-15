/**
 * Types shared across the rules engine.
 * See docs/phase-2-handoff.md section 5 for the authoritative spec.
 */

export type Severity = "error" | "warning" | "incomplete";

/**
 * A single rule violation. Carries enough to be actionable: which rule,
 * how severe, a human-readable explanation, and which diagram elements are
 * implicated.
 */
export interface Violation {
  /** e.g. "R615" */
  ruleId: string;
  layer: 1 | 2;
  severity: Severity;
  message: string;
  affectedInstanceIds: string[];
  affectedConnectionIds: string[];
}

/** The full output of validateDiagram: every violation found, in no particular order. */
export type ValidationResult = Violation[];

/** A legal endpoint for a wire being drawn from some other port. */
export interface Target {
  instanceId: string;
  portId: string;
}
