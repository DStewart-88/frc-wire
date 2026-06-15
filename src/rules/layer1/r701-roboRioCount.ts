import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import { instancesByCategory } from "../graph.js";
import type { Violation } from "../types.js";

/**
 * R701 (2026): exactly one roboRIO must be present, as the robot's sole
 * control root. Zero or multiple roboRIOs is an error.
 */
export function checkRoboRioCount(diagram: DiagramProject, library: DeviceLibrary): Violation[] {
  const roboRios = instancesByCategory(diagram, library, "robot-controller");

  if (roboRios.length === 1) return [];

  return [
    {
      ruleId: "R701",
      layer: 1,
      severity: "error",
      message:
        roboRios.length === 0
          ? "No roboRIO found. Exactly one roboRIO must be present as the robot's control root."
          : `${roboRios.length} roboRIOs found. Exactly one roboRIO may be present.`,
      affectedInstanceIds: roboRios.map((r) => r.id),
      affectedConnectionIds: [],
    },
  ];
}
