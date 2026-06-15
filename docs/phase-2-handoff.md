# Phase 2 Technical Handoff: Diagram Model & Rules Engine

*Handoff document for implementing Phase 2 of the FRC Wiring Diagram Tool.*

---

## 1. Context

This document hands off Phase 2 of the FRC Wiring Diagram Tool to Claude Code for implementation. The project vision, architecture, and rationale are documented elsewhere in the project files:

- **`frc-wiring-tool-plan.md`** — overall project vision, architecture, development phases
- **`device-library-schema.md`** — the JSON schema specification for device library files
- **`phase-1-handoff.md`** — the Phase 1 handoff (device library foundation), now complete

Phase 1 produced a working TypeScript project, a device-library schema validator, and ten validated device files. Phase 2 builds directly on that foundation. The device types, validator, and `loadDevice` loader from Phase 1 are reused here — the rules engine consumes loaded, template-expanded devices.

**Important:** Read the project plan and schema document before starting. The four-layer rules framework, the maintenance philosophy ("readable over clever"), and the architecture principle that *device files are descriptive, not prescriptive* are all load-bearing for this phase.

---

## 2. Phase 2 Goal

Per the project plan, Phase 2 produces:

> Implement Layer 1 and Layer 2 rules as pure functions operating on (devices, connections) data. Test with hand-written diagram files. No UI yet.
>
> Deliverable: Given a JSON diagram, the engine outputs lists of violations and legal connection targets.

Concretely, this means:

1. A **diagram model** — the data structure representing a specific robot's wiring (device instances, connections, subsystems, project metadata), with a loader and validator.
2. A **rules engine** — pure functions that take a diagram plus the device library and return violations and legal connection targets.
3. **Rule implementations** — the specific 2026 FRC rules listed in section 6, each as a named, documented function.
4. **Hand-written test diagrams** — two JSON files (one valid, one with known violations) plus a test suite that asserts the engine's output against them.

No UI is required in Phase 2. The deliverable is an engine that a later phase (or another developer) can call.

---

## 3. Note on User Background

The user is the product owner and FRC domain expert, and is new to software development. When starting implementation:

- Describe any non-obvious setup or structural steps in plain language before executing them.
- Where a technical decision has a product or maintenance consequence, surface it rather than deciding silently.
- Offer to explain tooling or architectural choices in non-technical terms if asked.

The user is comfortable with all the product and design decisions in this document; the mechanics of implementation are where guidance is most useful.

---

## 4. The Diagram Model

The diagram model is the saved state of one robot's wiring — what gets written to a file when a user saves a project and read back when they reopen it. It sits between the **device library** (what hardware *is*) and the **rules engine** (what's *legal*).

A core principle carried over from Phase 1: **internal identity is separate from display labels.** Every instance, connection, and subsystem has a stable internal `id` (a UUID) that never changes and is never shown to the user. Human-facing names are separate, freely editable fields. Connections reference UUIDs, so renaming anything never breaks a reference.

### 4.1 Structure

**Project (top level):**

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | string | Diagram-model schema version, for future migration |
| `projectName` | string | User-facing project name |
| `teamNumber` | integer | FRC team number |
| `ruleYear` | integer | The ruleset this project validates against (e.g. `2026`) |
| `subsystems` | array | Subsystem registry (see below) |
| `instances` | array | Device instances (see below) |
| `connections` | array | Connections between ports (see below) |

**Subsystem** (entry in `subsystems`):

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Internal, stable, never shown |
| `name` | string | User-facing, editable (e.g. "Drivetrain", "Turret", "26") |
| `color` | string (optional) | For visual grouping in a later UI phase |

**Device instance** (entry in `instances`):

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Internal, stable, never shown |
| `deviceId` | string | Reference to a device-library entry (e.g. `rev-spark-max`) |
| `name` | string | User-facing label; defaults to something like "SPARK MAX (1)" |
| `subsystemId` | string (UUID, optional) | References a subsystem `id`; optional (a device need not be assigned) |
| `canId` | integer (optional) | Only for devices that participate in CAN |
| `properties` | object (optional) | Instance values for device-level properties (e.g. `canTermination: true`) |
| `position` | `{ x, y }` (optional) | Canvas coordinates; unused until Phase 3 but included now to avoid a later schema bump |

**Connection** (entry in `connections`):

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Internal, stable, never shown |
| `from` | `{ instanceId, portId }` | One endpoint |
| `to` | `{ instanceId, portId }` | Other endpoint |
| `wireGauge` | integer (optional at draw time) | AWG; **required for a diagram to pass full validation** — see section 6, R622 |
| `wireColor` | string (optional) | |
| `notes` | string (optional) | Free text |

### 4.2 Diagram loader and validator

Mirror the Phase 1 pattern: a `loadDiagram` that reads a diagram file from disk, and a `validateDiagramModel` (structural, distinct from the *rules* validation in section 5) that confirms the file is well-formed before the rules engine runs. Structural checks include:

- Every `connection` endpoint references an `instanceId` that exists in `instances`.
- Every referenced `portId` exists on the corresponding instance's device (after Phase 1 template expansion).
- Every `instance.subsystemId`, if present, references a real subsystem.
- Every `instance.deviceId` resolves to a real library device.
- UUIDs are unique within their collection.

Structural validity is a precondition for rules validation. Keep the two concerns separate: `validateDiagramModel` answers "is this a well-formed diagram file?"; the rules engine answers "is this a legal robot?"

---

## 5. The Rules Engine API

The engine exposes two pure functions. Both take the diagram and the loaded device library as input and have no UI or filesystem dependencies.

### 5.1 `validateDiagram(diagram, library) → ValidationResult`

Runs every applicable rule against the whole diagram and returns all violations. This is the on-demand / on-save check.

A **violation** carries enough to be actionable:

```
{
  ruleId: string,            // e.g. "R615"
  layer: 1 | 2,              // rule layer
  severity: "error" | "warning" | "incomplete",
  message: string,           // human-readable explanation
  affectedInstanceIds: string[],   // instances implicated
  affectedConnectionIds: string[]  // connections implicated
}
```

Note the third severity, `incomplete`: used when a Layer 1 check cannot run because the diagram lacks required data (e.g. a wire with no gauge). This keeps the engine honest — it neither falsely passes nor falsely errors when it simply can't tell. See section 6, R622.

### 5.2 `getLegalTargets(instanceId, portId, diagram, library) → Target[]`

Given a port the user has selected to start a wire, returns the set of legal endpoints to connect to:

```
{ instanceId: string, portId: string }[]
```

This runs frequently (every time a user clicks a port in a later UI phase), so keep it efficient and free of side effects. For Phase 2 it is exercised purely through tests.

### 5.3 Rule organization

Per the planning decision, **rules are pure code, not data** — one named function per rule. Each rule function:

- Is named for what it checks (e.g. `checkRoboRioPowered`).
- Carries a comment with **both** the rule number and a plain-English description, because FRC rule *numbers* drift year to year while the *text* is stable. Example:

```typescript
// R615 (2026): roboRIO power must come from a non-switched, 10A-protected PD output.
function checkRoboRioPowered(diagram, library): Violation[] { ... }
```

- Returns an array of violations (empty if it passes).
- Accumulates rather than short-circuits, matching the Phase 1 validator's diagnostic style.

`validateDiagram` is the registry that runs each rule function and concatenates results. Adding or updating a rule = adding or editing one function. The annual ruleset update is expected to be a small, code-level task (handed to Claude Code with the new rulebook section), not a data migration.

---

## 6. Rules to Implement (2026 Ruleset)

These are drawn from the **2026 FRC Game Manual, *Rebuilt*, Section 8** (ROBOT Construction Rules), subsections 8.6 Power Distribution and 8.7 Control, Command & Signals System. Rule text is paraphrased here; the manual is authoritative.

**Scope note:** Many R-rules govern physical facts a wiring diagram cannot observe (battery weight, breaker accessibility, wire color along its length, mounting). Those are out of scope. Only rules checkable from the diagram graph are listed.

**Classification principle (from planning):** Rules that are hard "must" requirements, and any rule whose origin is *safety*, are **Layer 1**. Layer 2 is reserved for genuine guidance where the tool flags a likely issue and cites the rule. For the 2026 set, almost everything checkable is Layer 1; Layer 2 may end up thin, which is acceptable — do not force rules into it.

### Layer 1 — Hard constraints

**R701 — One roboRIO.** Exactly one instance whose device is a roboRIO must be present and must be the control root. Zero or multiple roboRIOs is an error.

**R702 — One legal radio.** Exactly one wireless bridge, the VH-109 (P/N VH-109, WCP-1538), must be present. (OM5P is China-events-only and out of scope.) Zero or multiple legal radios is an error.

**R609 — Main power chain.** The high-current path must follow: battery → a single 120A main breaker → a single power distribution device (PD: PDH, PDP, PDP 2.0, or AMPD). Validate the topology: battery positive routes through the main breaker to the PD input; battery negative routes directly to the PD (not through the breaker). Exactly one battery, one main breaker, one PD.

**R610 — Branch circuits from protected PD channels.** Every branch circuit must be sourced from a single protected output channel of the PD. Circuits must **not** connect to the PD's main power input. A device drawing power from anything other than a protected PD channel is an error.

**R615 — roboRIO power.** The roboRIO power input must connect to a non-switched, protected PD output on a 10A circuit, and nothing else may share that circuit. Flag a roboRIO powered from a switched channel, an incorrectly rated channel, or a channel shared with another load.

**R616 / R617 — Radio power.** For the VH-109, radio power must be sourced either by injection into the radio's "RIO" port via a passive injector/modified Ethernet cable connected to a PD, and/or wired directly to the radio's 12V input from a PD (R616). The supplying device must be on a non-switched protected PD output with a 10A breaker/fuse, not shared with another load (R617). Flag deviations.

**R621 — One motor controller per breaker.** Each motor controller's branch circuit must be protected by exactly one breaker, and (with the narrow motor-power-adapter-board exception noted in the rule) no other load may share that breaker. Two motor controllers on one PD channel is an error.

**R619 / R620 — Legal breaker/fuse values in the PD.** Only specified breaker/fuse values may protect PD channels. For the PDH specifically: ATM-style fuses ≤15A, with a single 20A exception permitted for powering a PCM/PH. Branch circuit protection must also respect Table 8-3 (e.g. motor controller up to 40A). Flag an out-of-range protection value on a channel.

**R622 — Wire gauge vs. breaker size (safety).** Each circuit must use wire at least as large as Table 8-4 requires for its protection level (e.g. 31–40A → 12 AWG min; 21–30A → 14 AWG min; 6–20A → 18 AWG min; and so on down the table). This is a **safety rule (thermal/fire) and is therefore Layer 1** despite being table-driven.

Handling of missing data (per planning decision):
- Gauge present and **too small for the breaker** → `severity: "error"`.
- Gauge present and adequate → pass.
- Gauge **absent** → `severity: "incomplete"` (a wire without a gauge cannot be verified). A diagram is **not** fully valid until every wire has a gauge; surface these so they must be resolved before export.
- Where the protecting breaker and the load make the **minimum legal gauge unambiguous**, the engine should expose a helper that derives that minimum so a later UI can auto-populate it. (Building the auto-populate UI is out of scope; the derivation helper is in scope and is useful for tests.)

### Layer 2 — Guidance with citations

Likely thin for 2026. If, while implementing, a checkable rule is better expressed as *guidance the tool flags and cites* rather than a hard determination, place it here with `layer: 2` and `severity: "warning"`. Do not invent Layer 2 rules to fill the layer.

### Explicitly NOT a rule (record, don't implement as Layer 1/2)

**CAN bus termination** is **not** in the FRC rulebook — it is a CTRE/device-spec requirement. Under the four-layer framework it is a **Layer 3** (device spec compatibility) concern and is **out of scope for Phase 2**. Do not implement it as a Layer 1 or Layer 2 rule. (The terminating resistor still exists as a real device in the library, and CAN topology may still be modeled; the engine simply does not *enforce* termination in this phase.)

---

## 7. Hand-Written Test Diagrams

Two diagram files, written by hand as instances of the section 4 model, drive the Phase 2 tests. Start minimal; more cases get added as real usage surfaces edge cases.

### 7.1 Minimal valid robot

The simplest legal wiring: battery → 120A main breaker → PD (PDH), with a roboRIO powered on a 10A channel, a VH-109 radio powered as specified, and one motor controller on its own correctly-sized breaker with an adequate wire gauge. Subsystems may be minimal or empty. **Expectation:** `validateDiagram` returns zero `error` and zero `incomplete` violations.

### 7.2 Known-violations robot

The same base with deliberate, specific defects introduced — for example: a second motor controller sharing one PD channel (R621), a wire with no gauge entered (R622 → `incomplete`), a wire too thin for its breaker (R622 → `error`), and/or the roboRIO on a switched channel (R615). **Expectation:** `validateDiagram` returns exactly the set of violations those defects should produce — no more, no fewer. This is the test that proves the engine catches what it should and doesn't over-report.

Tests should also exercise `getLegalTargets` on at least one port in the valid diagram and assert the returned endpoints are correct.

---

## 8. Definition of Done

Phase 2 is complete when:

1. The diagram-model types, `loadDiagram`, and `validateDiagramModel` exist and are exported.
2. The rules engine exposes `validateDiagram` and `getLegalTargets` as pure functions.
3. Every rule in section 6 is implemented as a named function commented with its rule number and plain-English description.
4. The minimal-valid test diagram validates with zero errors/incompletes.
5. The known-violations test diagram returns exactly the expected violation set.
6. `getLegalTargets` is covered by at least one test.
7. The R622 minimum-gauge derivation helper exists and is tested.
8. Tests pass, and a short README section documents how to run the rules engine and diagram tests.

---

## 9. Out of Scope for Phase 2

To prevent scope creep, the following are explicitly NOT part of Phase 2:

- Any UI or canvas work (Phase 3).
- Layer 3 (device spec compatibility, including CAN termination) and Layer 4 (team standards profiles).
- Year-versioned ruleset *infrastructure* — implement the 2026 rules directly; the static-file versioning system comes later. (Do, however, keep rule functions grouped so a future year's set is easy to fork.)
- Auto-populate UI for wire gauges (the derivation helper is in scope; the UI is not).
- Bill of materials, export, printing, subsystem filtering.
- Generic device blocks and additional devices beyond the Phase 1 ten.

If implementation reveals that a Phase 2 task depends on something scoped to a later phase, surface it as a question rather than expanding scope.

---

## 10. Reporting Back

After Phase 2 implementation, surface for review:

- Any place the 2026 rule text was ambiguous to encode, and the interpretation chosen.
- Any rule that turned out **not** to be checkable from the diagram model as currently designed, and what data would be needed to check it.
- Whether any rule landed more naturally in Layer 2 than expected, and why.
- Any diagram-model fields that proved missing or awkward while writing the test diagrams.
- Structural decisions about the engine that will affect Phases 3–6 (especially the UI in Phase 3, which will call `getLegalTargets` live).

This becomes the basis for the Phase 3 planning conversation.
