export * from "./types/device.js";
export * from "./validator/types.js";
export { validateDevice } from "./validator/validateDevice.js";
export { loadDevice } from "./validator/loadDevice.js";
export { expandPortTemplates } from "./validator/expandTemplates.js";

export * from "./types/diagram.js";
export { loadDeviceLibrary, type DeviceLibrary } from "./library/loadLibrary.js";
export { loadDiagram } from "./diagram/loadDiagram.js";
export {
  validateDiagramModel,
  type DiagramValidationResult,
} from "./diagram/validateDiagramModel.js";

export type { Severity, Violation, Target } from "./rules/types.js";
// Renamed on export: "./validator/types.js" already exports a ValidationResult
// (the Phase 1 device-validation result shape) — this is the rules engine's
// `Violation[]` result from docs/phase-2-handoff.md section 5.1.
export type { ValidationResult as RuleValidationResult } from "./rules/types.js";
export { validateDiagram } from "./rules/validateDiagram.js";
export { getLegalTargets } from "./rules/getLegalTargets.js";
export { minimumGaugeForProtection, deriveMinimumWireGauge } from "./rules/gauge.js";
