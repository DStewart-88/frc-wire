# Phase 2b Technical Handoff: Canvas Layout Fields

*Patch handoff between Phase 2 and Phase 3 of the FRC Wiring Diagram Tool.*

---

## 1. Context

This is a small, tightly scoped handoff that sits between Phase 2 (rules engine, complete) and Phase 3 (canvas UI, not yet started). It exists because Phase 3 planning surfaced a gap: device files describe ports *logically* (what they are) but carry no information about where ports sit *physically* on the device. The Phase 3 canvas needs that information to draw device blocks that mirror the real hardware, so a diagram reads like the actual device.

Rather than fold this into the Phase 3 handoff, it is broken out because it is mostly mechanical file replacement plus one validator addition, and it should be applied and verified *before* Phase 3 work begins.

Reference files already in the project:

- **`device-library-schema.md`** — the schema spec, now updated with the layout fields (see section 6.5). This is the authoritative description of the new fields.
- **`frc-wiring-tool-plan.md`** — overall project vision and phases.
- **`phase-2-handoff.md`** — the Phase 2 handoff, now complete.

**Read section 6.5 of the updated schema document before starting.** It defines the slot model, the two new fields, template layout behavior, rotation handling, and the validation rules. This handoff assumes that section has been read.

---

## 2. What Changed and Why

Two new optional fields were added to the device schema:

1. **`blockLayout`** (device-level): declares the canvas block's size in slot units (`width`, `height`) in the device's default orientation.
2. **`layout`** (port-level, also valid on port templates): declares which edge a port sits on (`side`) and its slot position along that edge (`order`).

Both are optional; when absent the renderer falls back to an auto-sized stacked layout (used for generic escape-hatch blocks). The full rationale and the slot model are in schema section 6.5. The short version: one slot is one port-width, slot pixel size is uniform across all devices, and blocks may be declared larger than their ports strictly require so that relative device sizes look realistic on the canvas.

A few decisions baked into the new device files that matter for implementation:

- **Layout reflects physical position, not signal direction.** E.g. the SPARK MAX `encoder` port has `direction: "input"` but is placed on the top edge with the motor output, because that mirrors the hardware.
- **Rotation is *not* in device files.** Device files describe default orientation only. Per-instance rotation belongs in the diagram model and is handled by the renderer in Phase 3 — out of scope here.
- **Gaps between port groups are expressed as gaps in `order` values.** Non-contiguous order numbers are intentional, not errors.

---

## 3. Tasks

### 3.1 Replace the schema document

Replace the repo's `device-library-schema.md` with the updated version produced alongside this handoff. The changes are: `blockLayout` added to the top-level field table, `layout` added to the port field table, new section 6.5, `sensor` added to the port-type enum (section 7.2), three worked examples rewritten, and two entries added to section 11.

### 3.2 Replace all ten device files

All ten device files were updated with `blockLayout` and per-port `layout`. Replace each repo file with the version produced alongside this handoff:

- `can-terminator.json`
- `ctre-pigeon-2.json`
- `eaton-cb285-120.json`
- `mk-es17-12.json`
- `ni-roborio-2.json`
- `rev-neo-v1-1.json`
- `rev-pdh.json`
- `rev-spark-max.json`
- `vh-109-radio.json`
- `wcp-kraken-x60.json`

**Two of these carry non-layout changes that need attention:**

- **`rev-pdh.json`** — the low-current channel port IDs were renamed to match the physical board labels: the old `lc-1`, `lc-2`, `lc-3`, `lc-switchable` are now `lc-20`, `lc-21`, `lc-22`, `lc-23` (with `lc-23` being the switchable channel). The high-current channels were also restructured: `hc-0` through `hc-9` are now explicit ports (they descend physically down the right edge while ascending in number, which a template cannot express), while `hc-10` through `hc-19` remain a template (`count: 10`, `indexStart: 10`). The expanded set of port IDs is unchanged (`hc-0` … `hc-19`); only the explicit/template split changed.
- **`ni-roborio-2.json`** — the `mxp` port was removed. It is a center-board expansion header with no edge position; it is deferred to a future library update. The `usb-b` port was retained.

### 3.3 Add layout validation to the schema validator

The validator does not yet know about the new fields. Add checks enforcing schema section 6.5.5:

- Port `order` must be an integer ≥ 0.
- Port `order` must be less than the relevant block dimension — `height` for `left`/`right` sides, `width` for `top`/`bottom` sides. A port may not fall outside the block.
- Two ports on the same `side` may not share an `order` value. **Note:** this check must run *after* template expansion, since templated ports occupy a run of order values (a template at `order: 0` with `count: 10` occupies orders 0–9, and a collision could occur between an expanded template port and an explicit port on the same side).
- If any port (explicit or expanded from a template) declares a `layout`, the device must declare a `blockLayout`.
- `blockLayout.width` and `blockLayout.height` must be positive integers.
- `side` must be one of `left`, `right`, `top`, `bottom`.

`sensor` must also be added to the valid port-type set if the validator enforces the type enum (it is now in schema section 7.2).

Keep these checks consistent with the existing validator's style and error-reporting format. Layout fields are optional, so a device file with no layout data at all must still validate cleanly.

### 3.4 Update test fixtures for renamed PDH ports

The Phase 2 diagram fixtures (and any rule code or tests) may reference the old PDH low-current port IDs. Grep the codebase and tests for `lc-1`, `lc-2`, `lc-3`, and `lc-switchable` and update any PDH references to the new `lc-20`–`lc-23` IDs. Be careful not to rewrite unrelated identifiers that happen to contain those substrings — match on the PDH context.

### 3.5 Add validator tests

Add test cases covering the new validation rules: at minimum a valid layout (passes), a port `order` outside the block bounds (fails), two ports colliding on the same side (fails), and a `layout` present with no `blockLayout` (fails). Follow the existing test structure.

### 3.6 Run the full suite

Run the existing device-library and rules-engine tests and confirm everything passes after the changes. The PDH port rename is the most likely source of a regression — a rules test that expected `lc-1` will now fail until updated.

---

## 4. Out of Scope

- **No rendering work.** This handoff only adds the data and its validation. Drawing blocks from `blockLayout`/`layout` is Phase 3.
- **No rotation handling.** That is diagram-model and renderer work for Phase 3.
- **No MXP port.** Deferred to a future library update.
- **No new devices.** This is a patch to the existing ten.

---

## 5. Definition of Done

- Schema doc and all ten device files replaced in the repo.
- Validator enforces all section 6.5.5 rules, with `sensor` accepted as a port type.
- Layout checks run after template expansion.
- Fixtures and rule code updated for the PDH `lc-*` rename; no stale references remain.
- New validator tests added and passing.
- Full existing test suite passing.

---

## 6. Notes for Review

When this is done, bring the validator changes and any fixture edits back to Claude chat for review before Phase 3 begins — same workflow as prior phases. Two things in particular are worth a look:

- The same-side `order`-collision check operating correctly across template-expanded ports (the trickiest of the new rules).
- Confirmation that the PDH rename didn't silently break a rule that keys off specific port IDs.
