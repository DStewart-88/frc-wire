import type { DeviceLibrary } from "../../library/loadLibrary.js";
import type { DiagramProject } from "../../types/diagram.js";
import type { Violation } from "../types.js";
import { checkDedicatedPdCircuit } from "./dedicatedPowerCircuit.js";

/** The only currently-legal FRC radio (P/N VH-109, WCP-1538). OM5P is China-events-only and out of scope. */
const RADIO_DEVICE_ID = "vh-109-radio";

/** R616/R617 require the radio to be on a dedicated 10A circuit. */
const RADIO_REQUIRED_AMPS = 10;

/**
 * R616/R617 (2026): the VH-109 radio must be powered from a non-switched,
 * 10A-protected PD output channel, not shared with any other load.
 *
 * R616 also permits powering the radio via Power-over-Ethernet injected into
 * its roboRIO-side ethernet port; that path requires a passive PoE injector,
 * which has no representation in the Phase 2 device library, so only the
 * direct-wire path is checked here (see docs/phase-2-handoff.md reporting
 * notes).
 */
export function checkRadioPower(diagram: DiagramProject, library: DeviceLibrary): Violation[] {
  return diagram.instances
    .filter((instance) => instance.deviceId === RADIO_DEVICE_ID)
    .flatMap((radio) =>
      checkDedicatedPdCircuit(diagram, library, radio, RADIO_REQUIRED_AMPS, {
        notConnected: "R616",
        wrongSource: "R616",
        switchedOrShared: "R617",
      }),
    );
}
