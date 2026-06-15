# FRC Wiring Diagram Tool

A tool for planning and documenting the electrical wiring of an FRC robot. See
`docs/frc-wiring-tool-plan.md` for the overall project vision and
`docs/device-library-schema.md` for the device data format.

This repo currently contains:

- **Phase 1**: the device library (`/devices`) and a schema validator
  (`/src/validator`) that checks device files against the schema described in
  `docs/device-library-schema.md`.
- **Phase 2**: the diagram model (`/src/diagram`, `/src/types/diagram.ts`) and
  the rules engine (`/src/rules`) that checks a wiring diagram against the
  2026 FRC rules — see `docs/phase-2-handoff.md`.

There is no UI yet.

## Setup

This is a [Node.js](https://nodejs.org/) / TypeScript project. You'll need
Node.js installed (v20 or later; this project was built and tested against
v22).

On Ubuntu/Debian, install Node.js and npm with:

```sh
sudo apt update
sudo apt install -y nodejs npm
```

Then install the project's dependencies (run once, from the repo root):

```sh
npm install
```

## Running the validator

To check every device file in `/devices` against the schema and print any
errors or warnings:

```sh
npm run validate
```

A device "passes" if it has no errors. Warnings (e.g. non-empty `note`
fields) don't fail validation — they flag details that still need
verification, as described in `docs/phase-1-handoff.md`.

## The diagram model and rules engine

A **diagram** (`DiagramProject`, see `src/types/diagram.ts`) describes one
robot's wiring: a list of device instances (each referencing a device from
`/devices` by id), the connections between their ports, and the subsystems
they're grouped into.

`loadDiagram(filePath, library)` reads a diagram JSON file and validates it
against a loaded device library (`loadDeviceLibrary(devicesDir)`), checking
that it's well-formed and that every instance and connection refers to a real
device and port. This answers "is this a well-formed diagram file?" — it does
not check rule legality.

The **rules engine** (`/src/rules`) answers "is this diagram legal under the
FRC rules?":

- `validateDiagram(diagram, library)` runs every 2026 rule (see
  `docs/phase-2-handoff.md` section 6) and returns a list of violations, each
  with a rule id, severity (`"error"`, `"warning"`, or `"incomplete"`), a
  human-readable message, and the instances/connections involved. An empty
  result means the diagram is fully valid.
- `getLegalTargets(instanceId, portId, diagram, library)` returns the list of
  ports a wire from the given port could legally connect to — used to drive
  connection suggestions in a future UI.
- `deriveMinimumWireGauge(diagram, library, connection)` and
  `minimumGaugeForProtection(breakerAmps)` derive the minimum legal wire gauge
  (Table 8-4) for a circuit, given the breaker/fuse protecting it.

Each rule (R701, R609, R615, etc.) is a separate named function under
`src/rules/layer1/`, commented with both its rule number and a plain-English
description of what it checks — see those files for the authoritative
behavior. `validateDiagram` is the registry that runs them all.

### Running the rules engine and diagram tests

The diagram model and rules engine are covered by the same test suite as
Phase 1:

```sh
npm test
```

Relevant test files:

- `tests/loadDiagram.test.ts` — diagram loading and structural validation.
- `tests/validateDiagram.test.ts` — runs the rules engine against two
  hand-written fixture diagrams in `tests/fixtures/diagrams/`: a minimal
  valid robot (expects zero violations) and a "known violations" robot
  (expects an exact, specific set of violations).
- `tests/getLegalTargets.test.ts` — legal-connection-target queries.
- `tests/gauge.test.ts` — the Table 8-4 minimum-gauge helper.

## Running the tests

```sh
npm test
```

This runs the test suite once. Use `npm run test:watch` to re-run tests
automatically as you edit files.

## Other commands

- `npm run build` — compile TypeScript to `dist/`
- `npm run lint` — check code style with ESLint
- `npm run format` — auto-format code with Prettier
- `npm run format:check` — check formatting without changing files

## Project structure

```
devices/        Device library data files (one JSON file per device)
src/
  types/        TypeScript types for the device schema and diagram model
  validator/    The Phase 1 schema validator (validateDevice, loadDevice, expandPortTemplates)
  library/      Loads the device library for use by the diagram/rules layers
  diagram/      Diagram model loading and structural validation (loadDiagram, validateDiagramModel)
  rules/        The rules engine (validateDiagram, getLegalTargets, gauge helper, per-rule checks in layer1/)
  index.ts      Public exports
tests/          Test suite (validator, diagram, and rules engine tests + fixtures)
docs/           Project plan, schema reference, and Phase 1/2 handoffs
scripts/        Standalone scripts (e.g. validate-devices.ts)
```

## How validation works

`validateDevice(data)` takes parsed JSON and returns either:

- `{ success: true, device, warnings }` — the device is valid. `device` has
  any `portTemplates` expanded into individual `ports`.
- `{ success: false, errors, warnings }` — the device has one or more
  problems. Each error/warning has a `path` (e.g. `ports[2].voltage.min`) and
  a `message`.

`loadDevice(filePath)` reads a JSON file from disk and runs it through
`validateDevice`.
