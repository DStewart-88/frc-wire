# Phase 1 Technical Handoff: Device Library Foundation

*Handoff document for implementing Phase 1 of the FRC Wiring Diagram Tool.*

---

## 1. Context

This document hands off Phase 1 of the FRC Wiring Diagram Tool to Claude Code for implementation. The project vision, architecture, and rationale are documented elsewhere in the project files:

- **`frc-wiring-tool-plan.md`** — overall project vision, architecture, development phases
- **`device-library-schema.md`** — the JSON schema specification for device library files

Both documents are authoritative for their respective topics. This handoff document covers only what's new: the implementation tasks for Phase 1 and the device-specific data needed to write the initial device files.

**Important:** Read both project files before starting. The schema document in particular contains design decisions and rationale that aren't repeated here.

---

## 2. Phase 1 Goal

Per the project plan, Phase 1 produces:

> A library that loads cleanly and validates against the schema.

Concretely, this means:

1. A working TypeScript project scaffold
2. A schema validator that loads device JSON files and reports errors
3. Ten device files written against the schema, all passing validation
4. A small test suite confirming the validator catches common errors

No UI is required in Phase 1. The deliverable is a library and validator that another developer (or Claude Code in a later phase) can build on.

---

## 3. Note on User Background

The user is new to software development and has not previously set up a repository or development environment. When starting implementation, please:

- Explain what needs to be installed before the project can run (Node.js, etc.)
- Walk through how to create and organize the project directory
- Explain what a git repository is and help initialize one locally
- Describe any setup steps in plain language before executing them
- Offer to explain any tooling decisions in non-technical terms if asked

The user is comfortable with the product and design decisions in this document but may need guidance on the mechanics of getting a development environment running.

---

## 4. Technical Decisions to Make

The project plan calls for TypeScript + React, but specific tooling choices haven't been made. Use your judgment for the following:

- Build system (Vite, tsc, etc.)
- Test framework (Vitest, Jest, etc.)
- Project structure / monorepo or single package
- Linting and formatting setup
- JSON schema validation approach (ajv, zod, or hand-written validator)

Optimize for a setup that will scale cleanly into Phases 2-6, which add a rules engine, UI, and export features. Keep dependencies minimal and code readable per the maintenance philosophy in the project plan.

---

## 5. Implementation Tasks

### 4.1 Project Scaffold

Set up a TypeScript project with the chosen tooling. Project structure should accommodate:

- Device library files (data, likely `/devices/*.json`)
- Schema validator (code)
- Tests
- Future additions: rules engine, diagram model, UI

### 4.2 Schema Validator

Implement a validator that:

- Loads a device file from disk
- Validates structure against the schema in `device-library-schema.md`
- Expands `portTemplates` into individually addressable ports at load time
- Returns a structured result: success with the parsed device, or failure with a list of specific errors (path + message)
- Warns (not errors) on non-empty `note` fields per the schema convention

The validator should be a pure function callable from tests. Surface-level CLI is fine but not required for Phase 1.

### 4.3 Device Files

Write the ten devices listed in section 5 below. Each device file should:

- Live in the devices directory as `{id}.json`
- Conform to the schema
- Pass validation cleanly
- Include `note` fields wherever data is uncertain (see section 5 per-device notes)

### 4.4 Tests

At minimum:

- Each device file loads and validates successfully
- The validator rejects deliberately malformed files (missing required fields, invalid enum values, ports without templates and no `ports` array, etc.)
- Template expansion produces the correct number of ports with correct IDs

---

## 6. Phase 1 Device List with Spec Data

Each device below has the spec data gathered during planning. Where data is uncertain or needs verification, that's flagged explicitly — use `note` fields in the device file to record those uncertainties.

### 5.1 Terminating Resistor

Simplest device. Single CAN port, no power, no other ports.

- `id`: `can-terminator`
- `name`: `CAN Terminating Resistor`
- `category`: `termination`
- One CAN port, bidirectional, 120 ohm
- Connector: depends on the specific terminator product; use `null` or note as TBD

### 5.2 Battery (MK ES17-12)

- `id`: `mk-es17-12`
- `name`: `MK ES17-12 Battery`
- `manufacturer`: `MK Battery`
- `partNumber`: `ES17-12`
- `category`: `battery`
- Two power outputs: positive and negative (see section 6 below for rationale)
  - Voltage range: approximately 10.5V (discharged) to 13.8V (fully charged), nominal 12V
  - Both terminals are nut-and-bolt style, `connector: null` (team-attached lugs)
  - Wire gauge: 6AWG minimum is a rules requirement, not a device limit; use a wide range like 2-8 AWG and note that the physical limit is just what fits on the bolt

### 5.3 Main Breaker (Eaton Bussmann CB285-120)

- `id`: `eaton-cb285-120`
- `name`: `120A Main Breaker`
- `manufacturer`: `Eaton Bussmann`
- `partNumber`: `CB285-120`
- `category`: `protection`
- Two power ports:
  - **Power input** ("Batt" side): connects to battery positive, threaded stud terminal, connector `ring-terminal`
  - **Power output** ("AUX" side): connects to PDH positive input, threaded stud terminal, connector `ring-terminal`
- Wire gauge: wide range (the stud accepts whatever ring terminal fits), note the actual physical limit is hardware-determined; rules engine enforces 6AWG minimum
- The negative wire from battery does NOT pass through the breaker — it goes directly from battery to PDH. This is reflected in the battery having both positive and negative output ports.

### 5.4 NEO Brushless Motor V1.1

- `id`: `rev-neo-v1-1`
- `name`: `NEO Brushless Motor V1.1`
- `manufacturer`: `REV Robotics`
- `partNumber`: `REV-21-1650`
- `category`: `motor`
- Two ports:
  - **Motor input**: 3 phase wires (red/black/white), hardwired, connector `wire`. This is the power side that connects to the SPARK MAX motor output.
  - **Sensor output**: JST-PH 6-pin, connector `jst-ph-6`, port type `sensor`, direction `output`. This is the integrated hall-effect encoder that connects to the SPARK MAX encoder port.
- Wire gauge on motor leads: 12AWG (confirmed by SPARK MAX docs; verify against NEO spec sheet)

### 5.5 Kraken X60

- `id`: `wcp-kraken-x60`
- `name`: `Kraken X60`
- `manufacturer`: `WestCoast Products`
- `partNumber`: `WCP-Kraken-X60` (verify against actual SKU)
- `category`: `motor-controller` or `motor` — this is a judgment call since the Kraken is integrated. Use `motor-controller` since that's its primary functional role (the rules engine treats it as such), but note this decision.
- Two ports:
  - **Power input**: 10AWG, pre-crimped ring terminals, connector `ring-terminal`
  - **CAN**: 22AWG, twisted pair, ring terminals also (verify), connector `ring-terminal`
- Voltage range: needs verification from spec sheet; assume 6-24V similar to other motor controllers as a starting point, but flag with a note
- No separate motor output port — the motor is integrated

### 5.6 Pigeon 2.0

- `id`: `ctre-pigeon-2`
- `name`: `Pigeon 2.0`
- `manufacturer`: `CTR Electronics`
- `partNumber`: `Pigeon-2` (verify SKU)
- `category`: `sensor`
- Two ports:
  - **Power input**: 2 wires (red/black), 22AWG, connector `wire`, voltage range to verify
  - **CAN**: 4 wires (2 yellow CANH, 1 green CANL, 1 black ground — the two yellows are electrically common per the manual), 22AWG, hardwired with 3-pin connector pair (one male, one female) for daisy chaining
- Direction on CAN: bidirectional, standard CAN

### 5.7 SPARK MAX

Most details captured in the schema document's worked example. Corrections needed from the example:

- `id`: `rev-spark-max`
- `name`: `SPARK MAX`
- `manufacturer`: `REV Robotics`
- `partNumber`: `REV-11-2158`
- `category`: `motor-controller`
- Ports:
  - **Power input**: 12AWG hardwired leads, `wire` connector, voltage range 5.5-24V
  - **Motor output**: 12AWG hardwired leads, `wire` connector
  - **Encoder output**: JST-PH 6-pin, port type `sensor`, direction `output` (this is the port that connects to the NEO's sensor output)
  - **CAN port 1** and **CAN port 2**: JST-PH 4-pin
  - **Data port** (top of device): JST-PH 6-pin (10-pin per some sources — verify)
  - **USB-C**: USB port for configuration/firmware. Omit from device file (not part of robot wiring per our earlier decision; it's diagnostic/config only). The schema document example incorrectly listed this as USB-B.

### 5.8 VH-109 Radio (Vivid-Hosting)

- `id`: `vh-109-radio`
- `name`: `VH-109 FRC Radio`
- `manufacturer`: `Vivid-Hosting`
- `partNumber`: `VH-109`
- `category`: `networking`
- Properties:
  - `aux1PoeEnabled`: boolean, default false, label "AUX1 PoE Output Enabled"
  - `aux2PoeEnabled`: boolean, default false, label "AUX2 PoE Output Enabled"
- Ports:
  - **Power input** (Weidmuller 12V): input, voltage range 4.5-19V (per docs), connector `null` (bare wire terminal)
  - **RIO ethernet**: ethernet, bidirectional, connector `rj45`, 10/100 Mbps, can also receive power via passive PoE (4.5-19V input)
  - **AUX1 ethernet**: ethernet, bidirectional, connector `rj45`, 10/100 Mbps
  - **AUX1 power output**: power output port at the same physical jack as AUX1 ethernet. Only active when `aux1PoeEnabled` is true. Voltage range matches input voltage (radio passes through whatever it receives).
  - **AUX2 ethernet** and **AUX2 power output**: same pattern as AUX1
  - **DS ethernet**: ethernet, bidirectional, connector `rj45`, 10/100/1000 Mbps, no PoE capability

This is the most complex device in the Phase 1 set due to the PoE switch behavior on AUX ports. See section 6.2 below for the design rationale.

### 5.9 Power Distribution Hub

Detailed worked example in the schema document. Use that as the starting point. Verifications/corrections:

- All 20 high current channels confirmed
- 3 static low current channels + 1 switchable, all 15A max
- Connector for high current and low current channels: WAGO lever-action (use a connector ID like `wago-lever`)
- High current wire gauge: 8-24 AWG (bare solid/stranded), 10-24 AWG with ferrule
- Low current wire gauge: 14-26 AWG (bare), 18-22 AWG with ferrule
- Power input wire gauge: 4-18 AWG stranded bare wire, connector `null`
- CAN ports: also WAGO lever-action (recent hardware update; previously push-button)
- `canTermination` property as documented in the schema

### 5.10 RoboRIO 2

Detailed worked example in the schema document. Use that as the starting point. Verifications:

- All port counts confirmed (10 PWM, 10 DIO, 4 analog, 4 relay, 2 USB-A, 1 USB-B, 1 ethernet, 1 MXP, 2 CAN, 1 power)
- USB-B note ("likely programming only") remains until verified
- `canTermination` property confirmed

---

## 7. Important Design Notes

These are decisions made during planning that aren't fully captured elsewhere and matter for implementation.

### 6.1 Battery and Main Breaker Wiring

The negative wire from the battery does NOT pass through the main breaker. It runs directly from battery to PDH. This means:

- The battery has TWO power output ports (positive and negative)
- The main breaker has ONE power input and ONE power output (positive only)
- The PDH power input is fed by two separate connections: positive from the breaker, negative directly from the battery

This is unusual but accurate to physical reality.

### 6.2 PoE on Radio AUX Ports

The VH-109 radio has DIP switches that enable passive PoE output on AUX1 and AUX2. When enabled, the same physical RJ45 jack carries both ethernet data and unregulated battery voltage on the power pins.

The design decision was to model this as two separate logical ports sharing a physical location:
- One ethernet port (always active)
- One power output port (active only when the corresponding `aux*PoeEnabled` property is true)

The rules engine will use the property values to determine whether the power output is "live" for compatibility checks.

This is the cleanest representation given the rest of the schema, but it's worth flagging as a potential refactor target if a more elegant solution emerges later.

### 6.3 Sensor Port for Encoders

Earlier discussion concluded that motor encoders (NEO sensor, etc.) should use port type `sensor` rather than introducing a new `encoder` type. The rules engine handles the "encoder must connect to associated motor" constraint via graph traversal rather than port type.

### 6.4 Ring Terminal Connector

`ring-terminal` should be added as a valid connector ID. Used by the main breaker, the Kraken, and potentially others.

### 6.5 Wire Gauge Represents Physical Acceptance

Per the schema's descriptive-only principle, `wireGauge` ranges should reflect what the connector physically accepts, not what FRC rules require. Rules-based minimums (like the 6AWG main power requirement) live in the rules engine.

---

## 8. Open Questions and Flagged Items

Items that warrant a `note` field on the relevant device or port until verified:

- SPARK MAX data port: 6-pin vs 10-pin discrepancy across sources
- Kraken X60: voltage range needs verification from CTR/WCP spec sheet
- Kraken X60: category choice (`motor-controller` vs `motor`) — picked `motor-controller` for now
- Pigeon 2.0: voltage range on power input
- RoboRIO USB-B: programming-only assumption needs confirmation
- Main breaker and battery wire gauge ranges: physical maximums need verification
- PDH connector ID: `wago-lever` is a placeholder; pick a clear convention for connector IDs across the library

---

## 9. Definition of Done

Phase 1 is complete when:

1. The project scaffold is set up and committed
2. All ten device files exist and validate successfully
3. The validator correctly identifies a representative set of malformed inputs (missing required fields, invalid enum values, missing both `ports` and `portTemplates`, malformed templates, etc.)
4. Tests pass
5. Notes are present on all flagged items from section 7
6. A short README documents how to run the validator and tests

---

## 10. Out of Scope for Phase 1

To prevent scope creep, the following are explicitly NOT part of Phase 1:

- Any UI work
- The rules engine (Phase 2)
- The diagram model (Phase 3)
- Additional devices beyond the ten listed
- Generic device blocks
- Connector library files
- Year-versioned rulesets

If decisions during implementation reveal that a Phase 1 task depends on something currently scoped to a later phase, surface that as a question rather than expanding scope.

---

## 11. Reporting Back

After Phase 1 implementation, surface for review:

- The chosen tooling decisions (build system, test framework, etc.) and why
- Any schema ambiguities encountered that should be clarified in `device-library-schema.md`
- Any device specs that couldn't be verified and remain noted as uncertain
- Any structural decisions about the codebase that will affect Phases 2-6

This becomes the basis for the next planning conversation.
