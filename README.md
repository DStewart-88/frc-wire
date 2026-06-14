# FRC Wiring Diagram Tool

A tool for planning and documenting the electrical wiring of an FRC robot. See
`docs/frc-wiring-tool-plan.md` for the overall project vision and
`docs/device-library-schema.md` for the device data format.

This repo currently contains **Phase 1**: the device library (`/devices`) and
a schema validator (`/src`) that checks device files against the schema
described in `docs/device-library-schema.md`. There is no UI yet.

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
  types/        TypeScript types for the device schema
  validator/     The schema validator (validateDevice, loadDevice, expandPortTemplates)
  index.ts       Public exports
tests/          Test suite (validator unit tests, device library tests, fixtures)
docs/           Project plan, schema reference, and Phase 1 handoff
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
