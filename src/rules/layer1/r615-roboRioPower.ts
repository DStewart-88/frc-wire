import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import { instancesByCategory } from "../graph.js";
import type { Violation } from "../types.js";
import { checkDedicatedPdCircuit } from "./dedicatedPowerCircuit.js";

/** R615 requires the roboRIO to be on a dedicated 10A circuit. */
const ROBORIO_REQUIRED_AMPS = 10;

/**
 * R615 (2026): the roboRIO must be powered from a non-switched, 10A-protected
 * PD output channel, and that channel must not be shared with any other load.
 */
export function checkRoboRioPower(diagram: DiagramProject, library: DeviceLibrary): Violation[] {
  return instancesByCategory(diagram, library, "robot-controller").flatMap((roboRio) =>
    checkDedicatedPdCircuit(diagram, library, roboRio, ROBORIO_REQUIRED_AMPS, {
      notConnected: "R615",
      wrongSource: "R615",
      switchedOrShared: "R615",
    }),
  );
}
