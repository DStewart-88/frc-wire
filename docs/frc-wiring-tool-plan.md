# FRC Wiring Diagram Tool — Development Plan

*First draft, compiled from initial scoping discussion.*

---

## 1. Project Vision

A graphical, drag-and-drop tool for planning and documenting the electrical wiring of an FRC robot. The tool is opinionated about FRC conventions — it knows what devices exist, what they connect to, and what the rules allow — so users spend their time documenting wiring rather than relearning rules.

**Target audience:** General FRC teams. The tool should be usable by roughly 90% of teams with vanilla setups. Edge cases are handled via generic device blocks rather than custom code.

**Core experience:** A team member opens the tool, drags devices from a palette onto a canvas, draws connections between them, and exports a clean printable diagram. The tool guides them toward legal connections and flags problems, but never makes decisions for them.

---

## 2. Architectural Overview

The tool is split into four distinct layers with clean boundaries. This separation is the foundation that makes the tool maintainable, updatable, and extensible.

### 2.1 Device Library (Data Layer)

A collection of structured definitions, one file per device (Kraken X60, REV Power Distribution Hub, RoboRIO, Pigeon 2.0, etc.). Each definition declares:

- Device identity (name, manufacturer, part number, category)
- Ports the device exposes (power input, CAN, PWM, signal outputs, etc.)
- The type of each port (12V power, CAN, PWM, signal)
- Constraints on each port (e.g., "power input must come from a PDH/PDP channel")
- Physical specifications useful for guidance (acceptable wire gauge range per port, current draw, voltage)
- Default metadata (typical wire color and gauge for each port type per FRC convention)

**Format:** Plain data files (JSON or YAML). Adding a new device is a data task, not a code task.

**Maintenance model:** Curated centrally by a small admin team (initially just the project owner). Updated annually before each season, with minor patches mid-season as needed. Not open community contribution — quality and consistency matter more than openness at this stage.

### 2.2 Diagram Model (State Layer)

The in-memory representation of a robot being designed. Pure data, no UI dependencies.

- A list of device instances, each referencing a library entry plus instance-specific data (user-assigned name, CAN ID, subsystem tag, position on canvas)
- A list of connections between device ports, each with type (CAN/power/PWM/signal), wire gauge, wire color, and any user notes
- Project metadata (project name, target rule year, team standards profile if used)

**Serialization:** Saved to a project file (JSON) for save/load.

### 2.3 Rules Engine (Logic Layer)

Pure functions that, given the diagram model and the device library, answer:

- What legal targets exist for a port the user wants to connect from?
- What violations exist in the current diagram?
- What missing required connections exist?
- What soft warnings apply (deviations from preferred but non-mandatory rules)?

Kept fully separate from the UI so it can be tested in isolation and updated independently when rules change.

### 2.4 UI Layer

The drag-and-drop canvas, device palette, property panel, validation sidebar, and export controls. Consumes the diagram model and calls the rules engine to filter choices and surface problems.

---

## 3. Rules Framework — Four Layers

The rules engine implements four conceptual layers that compose at evaluation time:

### Layer 1 — Hard Constraints (Non-Negotiable)

Safety-rooted rules that haven't changed in decades and realistically won't. Enforced by simply not offering illegal options in the UI. No override available, no warning needed — the option never appears.

*Examples:* Motors must connect to fused PDH/PDP channels. The RoboRIO is the only legal main controller.

### Layer 2 — Soft Rules (Legal Guidance, Overridable)

Rule-book requirements that are stable but could change year to year. The tool allows the user to deviate from these but shows a prominent warning citing the relevant rule number. This is where annual rule changes live.

*Example:* "10A breaker required on RoboRIO power input (Rule R-XXX)."

### Layer 3 — Device Spec Guidance (Physics, Not Rules)

Compatibility checks derived from device library data. No rule is being violated, but the tool flags mismatches between connected devices' specs.

*Example:* "Device A accepts 10-16 AWG, Device B accepts 8-14 AWG. The connecting wire must be 10-14 AWG."

### Layer 4 — Team Standards (Optional, User-Configured)

A team-level profile of preferred conventions (default wire gauge for motor power, preferred connector types, color conventions). Connections that deviate from team standards are flagged but never blocked.

*Status:* Designed-for but not MVP. Powerful long-term feature.

---

## 4. Year Versioning

Each project file stores the rule year it was created against. When opened, the tool loads that year's ruleset automatically. The user sees a small label on the project ("2026 Season") but doesn't manage versioning manually.

**Implementation:**
- Layer 1 rules are frozen and shared across all years
- Layer 2 rules are stored as year-specific files
- Old ruleset files are kept indefinitely as static data; no migration tooling needed
- Creating a new project defaults to the current season

This keeps maintenance lightweight (only Layer 2 needs annual updates) while preventing old diagrams from breaking when rules change.

---

## 5. User Interaction Model

### 5.1 Guided, Not Automatic

The tool does **not** auto-create connections. Users always draw their own wires. The tool's role is to:

- **Restrict** illegal connections from being drawn at all (Layer 1 rules)
- **Guide** users toward legal targets when drawing a connection — when a user clicks a port, the canvas dims everything except valid targets, which highlight as connectable
- **Warn** about soft-rule violations or spec mismatches after a connection is made (Layers 2 and 3)
- **Validate** the complete diagram for missing required connections, duplicate CAN IDs, etc.

This approach reflects how teams actually work: they typically know the specific port they intend to use, or they're documenting existing physical wiring. Auto-connection would create more cleanup work than it would save.

### 5.2 Subsystem Tagging

When a device is added, the user assigns it to a subsystem (drivetrain, arm, intake, climber, etc.). This metadata is required from the start because:

- A typical robot has ~50 devices (potentially up to 100), and visual organization by subsystem is essential for readability at that scale
- Subsystem filtering is a planned future feature; tagging at creation time avoids painful retrofitting

### 5.3 Generic Device Blocks

For devices not in the curated library (custom circuit boards, unusual sensors), users can add a generic block and fill in a form via the UI: name, voltage, current draw, communication lines, port specs. No JSON editing required. This handles the edge cases without bloating the curated library.

If a properly defined device is later added to the library, users can swap a generic block for the real definition.

---

## 6. Outputs — Priority Stack

### MVP: Visual Diagram

A clean, printable schematic showing all devices and connections, organized by subsystem. Usable in the pit for diagnosis and verification. Export to PDF or PNG.

### Soon After: Bill of Materials

A structured list of every device and connector in the diagram. Primary use case: pit team checking spares inventory against the BOM when packing for events.

Note: Wire lengths are **not** included. Most teams cut wire to length from bulk rolls during assembly rather than pre-planning lengths. Including length would add input burden without commensurate value.

### Later (Worth Designing For): Interactive Visualizations

- Highlight a single CAN loop, fading other devices
- Filter view by subsystem
- Trace power paths from battery to a selected device
- Toggle visibility of connection types (show only CAN, only power, etc.)

These features fall out naturally from a well-designed data model — they're mostly UI work, not new data or logic. Designing the model correctly now means they can be added later without restructuring.

---

## 7. Scope Boundaries

### In Scope
- Electrical wiring (power, CAN, PWM, signal lines)
- Standard FRC devices via curated library
- Custom devices via generic blocks
- Rules validation for connection legality
- Spec compatibility guidance
- Visual diagram and BOM export
- Year-versioned rulesets

### Out of Scope (For Now)
- Pneumatics (revisit if wiring tool succeeds)
- Mechanical layout / CAD integration
- Wire length specification
- Open community library contributions
- Automatic wire routing or placement

---

## 8. Technology Recommendation

**Web application** built with:
- **TypeScript + React** for the UI
- **React Flow** (or equivalent) for the canvas, drag-and-drop, and connection drawing — this gives us a huge head start on the visual mechanics
- **JSON** for device library files and project files
- Pure TypeScript functions for the rules engine, fully unit-testable without UI

**Why web:**
- No installation friction for teams (just visit a URL)
- Cross-platform automatically (any laptop with a browser)
- Easy to share project files
- Can run offline once loaded
- Easy to host as a static site (no server costs)

A desktop app via Electron is a possible future path if offline reliability becomes a concern, but web-first is the right starting point.

---

## 9. Development Phases

Each phase produces something usable on its own. This avoids the trap of building three layers before having anything to look at.

### Phase 1 — Data Model and Library Schema
Define the JSON schema for a device. Write 5-10 device files by hand (RoboRIO, PDH, Kraken X60, NEO, SPARK MAX, Pigeon 2.0, radio, battery, main breaker, a few sensors). Write a validator that loads and verifies them. No UI yet.

*Deliverable:* A library that loads cleanly and validates against the schema.

### Phase 2 — Rules Engine as Standalone Module
Implement Layer 1 and Layer 2 rules as pure functions operating on (devices, connections) data. Test with hand-written diagram files. No UI yet.

*Deliverable:* Given a JSON diagram, the engine outputs lists of violations and legal connection targets.

### Phase 3 — Minimal UI
Static canvas, device palette, ability to add devices and draw connections, save/load to JSON. Validation sidebar showing problems. Ugly but functional.

*Deliverable:* A usable end-to-end tool that produces real diagrams, even if rough-looking.

### Phase 4 — Guided Connections and Polish
Implement the "click a port, see legal targets" interaction. Subsystem tagging UI. Property panels for devices. Visual polish.

*Deliverable:* The tool starts feeling like what the user envisioned.

### Phase 5 — Export and Library Growth
PDF/PNG diagram export. BOM export. Expand device library to cover common FRC devices comprehensively.

*Deliverable:* MVP feature-complete.

### Phase 6 — Interactive Features and Team Standards
Subsystem filtering, CAN loop highlighting, team standards profiles (Layer 4), and other advanced features.

*Deliverable:* Power-user features for teams that want them.

---

## 10. Open Questions to Revisit

These weren't critical for the initial plan but will matter as development progresses:

- **Specific JSON schema for devices** — to be designed in Phase 1
- **Specific rule encoding format** — how Layer 1 and Layer 2 rules are represented in data vs. code
- **Project file format details** — versioning, backward compatibility
- **Hosting and distribution** — where the web app lives, how teams find it
- **Naming and branding** for the tool itself

---

## 11. Maintenance Philosophy

- **Code maintenance:** Keep the codebase readable and straightforward over clever or highly abstracted. The owner should be able to read, modify, and extend it.
- **Device library:** Adding a new device is a data task, completable in 15-30 minutes by anyone with the device datasheet. No code changes required.
- **Annual ruleset updates:** A diff of Layer 2 rules each season, not a rewrite. Lightweight enough for one person to execute over a weekend.
- **Backward compatibility:** Old project files keep working because their ruleset is preserved.
