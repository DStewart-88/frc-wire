import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import type { Violation } from "../types.js";

/** The only currently-legal FRC radio (P/N VH-109, WCP-1538). OM5P is China-events-only and out of scope. */
const LEGAL_RADIO_DEVICE_ID = "vh-109-radio";

/**
 * R702 (2026): exactly one legal wireless bridge — the VH-109 — must be
 * present. Zero or multiple legal radios is an error.
 */
export function checkLegalRadioCount(
  diagram: DiagramProject,
  _library: DeviceLibrary,
): Violation[] {
  const radios = diagram.instances.filter((inst) => inst.deviceId === LEGAL_RADIO_DEVICE_ID);

  if (radios.length === 1) return [];

  return [
    {
      ruleId: "R702",
      layer: 1,
      severity: "error",
      message:
        radios.length === 0
          ? "No VH-109 radio found. Exactly one legal radio (VH-109) must be present."
          : `${radios.length} VH-109 radios found. Exactly one legal radio may be present.`,
      affectedInstanceIds: radios.map((r) => r.id),
      affectedConnectionIds: [],
    },
  ];
}
