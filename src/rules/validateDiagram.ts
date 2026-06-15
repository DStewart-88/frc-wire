import type { DeviceLibrary } from "../library/loadLibrary.js";
import type { DiagramProject } from "../types/diagram.js";
import { checkMainPowerChain } from "./layer1/r609-mainPowerChain.js";
import { checkBranchCircuitSources } from "./layer1/r610-branchCircuitSources.js";
import { checkRoboRioPower } from "./layer1/r615-roboRioPower.js";
import { checkRadioPower } from "./layer1/r616-r617-radioPower.js";
import { checkBreakerValues } from "./layer1/r619-r620-breakerValues.js";
import { checkMotorControllerBreakerSharing } from "./layer1/r621-motorControllerBreakers.js";
import { checkWireGauge } from "./layer1/r622-wireGauge.js";
import { checkRoboRioCount } from "./layer1/r701-roboRioCount.js";
import { checkLegalRadioCount } from "./layer1/r702-legalRadioCount.js";
import type { ValidationResult } from "./types.js";

/**
 * Layer 1 checks for the 2026 ruleset, in the order they're listed in
 * docs/phase-2-handoff.md section 6. Kept as a plain array (rather than,
 * say, per-year subdirectories) so a future year's ruleset can fork this
 * list — see section 9's note on deferring year-versioned infrastructure.
 */
const LAYER_1_RULES_2026 = [
  checkRoboRioCount,
  checkLegalRadioCount,
  checkMainPowerChain,
  checkBranchCircuitSources,
  checkRoboRioPower,
  checkRadioPower,
  checkMotorControllerBreakerSharing,
  checkBreakerValues,
  checkWireGauge,
];

/**
 * Runs every applicable rule against the whole diagram and returns all
 * violations. Rules accumulate rather than short-circuit, matching the
 * Phase 1 validator's diagnostic style.
 */
export function validateDiagram(diagram: DiagramProject, library: DeviceLibrary): ValidationResult {
  return LAYER_1_RULES_2026.flatMap((check) => check(diagram, library));
}
