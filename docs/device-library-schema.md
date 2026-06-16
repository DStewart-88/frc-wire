# Device Library Schema Reference

*Reference document for the FRC Wiring Diagram Tool device library.*

This document describes the structure and conventions for device definition files. Each device in the library is a JSON file that conforms to this schema.

---

## 1. Purpose and Principles

The device library is a collection of descriptive data files, one per device. Each file describes the physical and electrical reality of a piece of hardware — what ports it has, what those ports accept or deliver, and what factory connectors come with it.

Three principles guide the schema:

1. **Descriptive only.** Device files describe what hardware is, not what's legal or recommended. All "must connect to X" logic lives in the rules engine, not here.
2. **Data, not code.** Adding a new device is a data task, completable in 15-30 minutes by anyone with the device datasheet.
3. **Stable shape.** The schema should change rarely. New optional fields can be added without versioning; structural changes warrant a schema version bump.

---

## 2. File Format

- One JSON file per device
- UTF-8 encoded
- Filename matches the device `id` (e.g. `rev-spark-max.json`)

---

## 3. Top-Level Device Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | yes | Schema version this file conforms to. Currently `"1.0"`. |
| `id` | string | yes | Unique identifier, lowercase with hyphens (e.g. `rev-spark-max`). |
| `name` | string | yes | Display name shown in the device palette. |
| `manufacturer` | string | yes | Company that makes the device. |
| `partNumber` | string | yes | Manufacturer's part number. |
| `category` | string | yes | Device category. See section 7 for valid values. |
| `blockLayout` | object | no | Canvas block dimensions in slot units. See section 6.5. |
| `properties` | object | no | Device-level configurable properties. See section 6. |
| `ports` | array | yes* | Explicit list of ports. |
| `portTemplates` | array | yes* | Template-expanded port definitions. See section 5. |
| `note` | string | no | Working note for unresolved details. Should be empty in production files. |

\* Either `ports`, `portTemplates`, or both must be present. A device with no ports is invalid.

---

## 4. Port Specification

A port is a logical connection point on a device. Each port represents a place where one wire (or one connector with multiple wires that go to the same destination) attaches.

### 4.1 Port Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Identifier unique within this device (e.g. `power-in`, `can-1`). |
| `name` | string | yes | Display name shown in the UI. |
| `type` | string | yes | Port type. See section 7 for valid values. |
| `direction` | string | yes | `input`, `output`, or `bidirectional`. From the device's perspective. |
| `voltage` | object | no | Voltage range. Required for `power` ports. See 4.2. |
| `wireGauge` | object | no | Acceptable wire gauge range. See 4.3. |
| `current` | object | no | Current limit. See 4.4. |
| `connector` | string \| null | yes | Factory connector. See section 8. |
| `switchable` | boolean | no | For power outputs only. Whether the port can be switched on/off in software. |
| `layout` | object | no | Physical position of the port on the canvas block. See section 6.5. |
| `note` | string | no | Working note for unresolved details. |

### 4.2 Voltage Range

```json
"voltage": { "min": 6, "max": 14, "nominal": 12 }
```

- `min` / `max`: The range the port actually delivers (outputs) or requires (inputs).
- `nominal`: Optional. The expected typical voltage.

For an unregulated 12V output the range reflects realistic battery sag (e.g. `6-14`). For a regulated output the range is tight (e.g. `11.8-12.2`). The rules engine infers regulation from the tightness of the range; no separate field is needed.

### 4.3 Wire Gauge Range

```json
"wireGauge": { "min": 10, "max": 16 }
```

Values are AWG. Lower numbers are thicker wire. Represents what the connector physically accepts, not what the team should use (that's a Layer 4 team standards concern).

### 4.4 Current

```json
"current": { "max": 40 }
```

For power output ports, the maximum current the port can deliver (e.g. a PDH high current channel maxes at 40A regardless of breaker).

---

## 5. Port Templates

When a device has many identical ports (e.g. the PDH's 20 high current channels), use a template instead of listing each port explicitly. Templates are expanded into individually addressable ports at load time.

### 5.1 Template Fields

A port template has all the fields of a regular port plus:

| Field | Type | Required | Description |
|---|---|---|---|
| `count` | integer | yes | Number of ports to expand to. |
| `indexStart` | integer | yes | Starting number for the index (usually `0` or `1`). |

The `id` and `name` fields use `{n}` as a placeholder for the index.

### 5.2 Example

```json
"portTemplates": [
  {
    "id": "hc-{n}",
    "name": "High Current Channel {n}",
    "type": "power",
    "direction": "output",
    "voltage": { "min": 6, "max": 14 },
    "current": { "max": 40 },
    "wireGauge": { "min": 10, "max": 2 },
    "connector": "wago-lever",
    "switchable": false,
    "count": 20,
    "indexStart": 0
  }
]
```

This expands to 20 ports: `hc-0` through `hc-19`, each with the same specifications.

### 5.3 When to Use Templates

Use templates when a device has 3+ ports that are functionally identical. For fewer ports, or for ports that differ in meaningful ways, list them explicitly.

---

## 6. Device-Level Properties

Properties describe configurable attributes of a device that aren't ports — switches, jumpers, or internal settings that affect electrical behavior.

The library file declares that a property exists; the diagram model records the actual value for each device instance.

### 6.1 Property Fields

```json
"properties": {
  "canTermination": {
    "type": "boolean",
    "default": false,
    "label": "Internal CAN Termination Enabled"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Data type (`boolean`, `string`, `number`). |
| `default` | varies | yes | Default value for new device instances. |
| `label` | string | yes | Display label shown in the property panel. |

---

## 6.5 Canvas Layout

The `blockLayout` and port `layout` fields describe how a device is drawn on the diagram canvas. Both are optional. When absent, the renderer falls back to a simple auto-sized stacked layout (used for generic escape-hatch device blocks). When present, they let a device block roughly mirror the physical shape of the hardware, so the diagram reads like the real device.

### 6.5.1 The Slot Model

A block is divided into a grid of **slots**. One slot equals one port-width in rendered size, and the slot size in pixels is the same across all devices. This keeps every device on a consistent visual grid: a block declared as 24 slots tall renders taller than one declared as 6 slots tall, but proportionally, not absurdly so.

`blockLayout` declares the total slot count on each axis in the device's **default (unrotated) orientation**:

```json
"blockLayout": {
  "width": 8,
  "height": 24
}
```

- `width`: slot count left-to-right
- `height`: slot count top-to-bottom

A block may be declared **larger** than the minimum needed to fit its ports, to make its rendered proportions match the real hardware's relative size. It may not be declared smaller than its ports require.

### 6.5.2 Port Layout

Each port may declare where it sits on the block:

```json
"layout": {
  "side": "left",
  "order": 3
}
```

- `side`: one of `"left"`, `"right"`, `"top"`, `"bottom"` — which edge the port handle appears on, in default orientation.
- `order`: zero-based slot position along that side. On left/right sides, order counts top-to-bottom. On top/bottom sides, order counts left-to-right.

**Gaps** are created by leaving space between order values. Because each integer step is one slot, ports at order 0 and order 2 have one empty slot between them. Non-contiguous order numbers are the intended way to visually separate port groups (e.g. the gap between a PDH's high-current and low-current channels). A conventional gap of 2–3 slots reads as a clear group break.

### 6.5.3 Layout on Port Templates

A port template may carry a `layout`. The template's `order` is the **starting** slot for the first expanded port; each subsequent expanded port increments order by 1. So a template with `count: 10`, `indexStart: 10`, and `layout: { "side": "left", "order": 0 }` produces ports occupying orders 0–9 on the left side.

When a run of templated ports must appear in reverse physical order (e.g. ascending channel numbers that descend physically down an edge), the template's auto-increment cannot express this — list those ports explicitly instead, assigning each its own order. (The PDH high-current channels are the one current device where this arises.)

### 6.5.4 Rotation

Rotation is **not** a device-file concern. A device's `layout` always describes default orientation. The diagram model records any rotation applied to a specific instance (0°, 90°, 180°, or 270°), and the renderer transforms port positions accordingly — a `left`-side port on a device rotated 90° renders on a different edge. `width` and `height` are likewise swapped by the renderer on 90°/270° rotation. Device files never account for rotation.

### 6.5.5 Validation Rules

The schema validator enforces:

- Port `order` must be ≥ 0.
- Port `order` must be less than the relevant block dimension (`height` for left/right sides, `width` for top/bottom sides). A port cannot fall outside the block.
- Two ports on the same `side` may not share an `order` value.
- If any port declares a `layout`, the device must declare a `blockLayout`.
- `blockLayout` `width` and `height` must be positive integers.

---

## 7. Enumerated Values

### 7.1 Categories

- `robot-controller` — the RoboRIO
- `power-distribution` — PDH, PDP
- `motor-controller` — SPARK MAX, Talon FX, etc.
- `motor` — Kraken, NEO, etc.
- `sensor` — gyros, encoders, limit switches
- `camera` — Limelight, generic USB cameras, other vision devices
- `coprocessor` — Orange Pi, Raspberry Pi, dedicated processing hardware
- `networking` — robot radio, network switches
- `regulator` — voltage regulators
- `battery` — main battery, auxiliary battery packs
- `protection` — main breaker, fuses
- `termination` — CAN terminating resistor
- `other` — for devices that don't fit cleanly

### 7.2 Port Types

| Type | Description |
|---|---|
| `power` | DC power, regulated or unregulated. |
| `motor` | Motor output from a controller. |
| `can` | CAN bus. |
| `pwm` | PWM signal. |
| `dio` | Digital I/O. |
| `analog-in` | Analog input. |
| `relay` | Relay output. |
| `ethernet` | Ethernet. |
| `usb-a` | USB-A host port. |
| `usb-b` | USB-B device port. |
| `mxp` | MXP expansion port. |
| `data` | Generic data port (e.g. SPARK MAX expansion). |
| `sensor` | Sensor signal (e.g. hall-effect encoder output/input between a motor and its controller). |

### 7.3 Directions

- `input` — power or signal flows into the device.
- `output` — power or signal flows out of the device.
- `bidirectional` — bus participants (CAN, ethernet) or configurable ports (DIO).

Always defined from the device's perspective.

---

## 8. Connector Conventions

The `connector` field describes the factory connector on a port — what ships with the device.

| Value | Meaning |
|---|---|
| String ID (e.g. `"jst-ph-4"`) | The device has this specific factory connector on this port. |
| `"wire"` | The device has hardwired leads on this port (no connector). |
| `null` | The port is a bare terminal that accepts whatever the team chooses. |

Team-added connectors (e.g. Anderson Powerpoles) do not belong in the device file. They are recorded as metadata on connections in the diagram model.

---

## 9. The Note Field

Both devices and ports may have an optional `note` field for working comments about unresolved details. Examples:

- `"Likely programming only — verify if used during robot operation"`
- `"Connector type not confirmed against spec sheet"`

**Convention:** Notes are for in-progress work only. A device file is not considered production-ready while it contains notes. The schema validator should flag any non-empty `note` field as a warning.

---

## 10. Worked Examples

### 10.1 SPARK MAX

A motor controller. Demonstrates the basic shape of a device file with no templates, plus the layout fields: inputs grouped on the bottom edge, outputs and the motor-related encoder port grouped on the top.

```json
{
  "schemaVersion": "1.0",
  "id": "rev-spark-max",
  "name": "SPARK MAX",
  "manufacturer": "REV Robotics",
  "partNumber": "REV-11-2158",
  "category": "motor-controller",
  "blockLayout": { "width": 5, "height": 8 },
  "ports": [
    {
      "id": "power-in",
      "name": "Power Input",
      "type": "power",
      "direction": "input",
      "voltage": { "min": 5.5, "max": 24 },
      "wireGauge": { "min": 12, "max": 12 },
      "connector": "wire",
      "layout": { "side": "bottom", "order": 1 }
    },
    {
      "id": "can-1",
      "name": "CAN 1",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4",
      "layout": { "side": "bottom", "order": 3 }
    },
    {
      "id": "can-2",
      "name": "CAN 2",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4",
      "layout": { "side": "bottom", "order": 4 }
    },
    {
      "id": "motor-out",
      "name": "Motor Output",
      "type": "motor",
      "direction": "output",
      "wireGauge": { "min": 12, "max": 12 },
      "connector": "wire",
      "layout": { "side": "top", "order": 1 }
    },
    {
      "id": "encoder",
      "name": "Encoder Port",
      "type": "sensor",
      "direction": "input",
      "connector": "jst-ph-6",
      "layout": { "side": "top", "order": 3 }
    }
  ]
}
```

The `encoder` port is placed with the outputs on the top edge even though its direction is `input` — it physically connects to the attached motor, so co-locating it with `motor-out` mirrors the hardware. Layout grouping reflects physical position, not signal direction.

### 10.2 Power Distribution Hub (layout focus)

The full PDH file (`rev-pdh.json`) is the authoritative source. The snippet below shows only how the new layout fields work on a complex device — a wide block with high-current channels descending each vertical edge, low-current channels below them on the left, and CAN plus power on the bottom edge.

The PDH high-current channels illustrate the reverse-order case from section 6.5.3: channels `hc-0` through `hc-9` ascend in number but descend physically down the right edge, so they are listed explicitly (hc-9 at order 0 ... hc-0 at order 9) rather than templated. Channels `hc-10` through `hc-19` descend both in number and position down the left edge, so they use a template.

```json
{
  "blockLayout": { "width": 8, "height": 24 },
  "ports": [
    {
      "id": "power-in",
      "name": "Main Power Input",
      "type": "power",
      "direction": "input",
      "layout": { "side": "bottom", "order": 7 }
    },
    {
      "id": "can-1",
      "type": "can",
      "direction": "bidirectional",
      "layout": { "side": "bottom", "order": 0 }
    },
    {
      "id": "hc-9",
      "name": "High Current Channel 9",
      "type": "power",
      "direction": "output",
      "current": { "max": 40 },
      "layout": { "side": "right", "order": 0 }
    },
    {
      "id": "lc-20",
      "name": "Low Current Channel 20",
      "type": "power",
      "direction": "output",
      "current": { "max": 15 },
      "layout": { "side": "left", "order": 12 }
    }
  ],
  "portTemplates": [
    {
      "id": "hc-{n}",
      "name": "High Current Channel {n}",
      "type": "power",
      "direction": "output",
      "current": { "max": 40 },
      "count": 10,
      "indexStart": 10,
      "layout": { "side": "left", "order": 0 }
    }
  ]
}
```

Note the gap on the left edge: the template fills orders 0–9 (hc-10 through hc-19), then `lc-20` begins at order 12, leaving two empty slots as a visible group break.

### 10.3 RoboRIO 2 (four-sided layout focus)

The full RoboRIO file (`ni-roborio-2.json`) is authoritative. The RoboRIO is the clearest example of ports distributed across all four edges: power, USB, and ethernet along the top; PWM down the right; CAN and DIO down the left; relay and analog along the bottom. The snippet below shows one port per side plus how templates place a run of ports along an edge.

```json
{
  "blockLayout": { "width": 10, "height": 16 },
  "ports": [
    {
      "id": "power-in",
      "type": "power",
      "direction": "input",
      "layout": { "side": "top", "order": 0 }
    },
    {
      "id": "can-1",
      "type": "can",
      "direction": "bidirectional",
      "layout": { "side": "left", "order": 0 }
    }
  ],
  "portTemplates": [
    {
      "id": "pwm-{n}",
      "type": "pwm",
      "direction": "output",
      "count": 10,
      "indexStart": 0,
      "layout": { "side": "right", "order": 0 }
    },
    {
      "id": "dio-{n}",
      "type": "dio",
      "direction": "bidirectional",
      "count": 10,
      "indexStart": 0,
      "layout": { "side": "left", "order": 4 }
    },
    {
      "id": "relay-{n}",
      "type": "relay",
      "direction": "output",
      "count": 4,
      "indexStart": 0,
      "layout": { "side": "bottom", "order": 0 }
    },
    {
      "id": "analog-{n}",
      "type": "analog-in",
      "direction": "input",
      "count": 4,
      "indexStart": 0,
      "layout": { "side": "bottom", "order": 6 }
    }
  ]
}
```

On the left edge, CAN occupies orders 0–1 and the DIO template begins at order 4, leaving a gap. On the bottom edge, the relay template fills orders 0–3 and analog begins at order 6, again with a visible break. The MXP center-board expansion port is omitted from the layout — it sits in the middle of the board rather than on an edge, and is a candidate for a future library update.

---

## 11. Decisions Captured

The following design decisions are reflected in this schema and are worth preserving as rationale for future development:

- **A port is a logical connection point, not a physical wire count.** Multi-wire connections (motor output with three wires, power input with two) are still one port.
- **CAN is modeled as multiple distinct bidirectional ports per device.** Branch detection is handled by the rules engine via graph degree checks.
- **Constraints are not encoded in device files.** All "must connect to X" logic lives in the rules engine. Device files describe hardware; rules describe legality.
- **Voltage range tightness implicitly conveys regulation.** No separate `regulated` flag is needed; the rules engine infers it from the range.
- **The 6V floor for unregulated power is a rules engine constant**, not a per-device value. Revisable centrally without touching device files.
- **Connector metadata describes factory connectors only.** Team-added connectors are diagram-level metadata.
- **Device-level configurable properties (like CAN termination switches) live in `properties`**, not as ports. The library declares them; the diagram instance records actual values.
- **Canvas layout is descriptive physical position, not signal logic.** Ports are placed on the block to mirror where they sit on real hardware, even when that conflicts with their electrical direction (e.g. a motor's encoder input sits with the motor output). The slot grid keeps all devices on a consistent visual scale, and block dimensions may exceed port requirements to keep relative device sizes realistic.
- **Rotation is instance state, not device data.** Device files always describe default orientation; the diagram model records per-instance rotation and the renderer transforms positions. This keeps device files free of presentation state.
