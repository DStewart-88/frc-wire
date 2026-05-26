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

A motor controller. Demonstrates the basic shape of a device file with no templates or device-level properties.

```json
{
  "schemaVersion": "1.0",
  "id": "rev-spark-max",
  "name": "SPARK MAX",
  "manufacturer": "REV Robotics",
  "partNumber": "REV-11-2158",
  "category": "motor-controller",
  "ports": [
    {
      "id": "power-in",
      "name": "Power Input",
      "type": "power",
      "direction": "input",
      "voltage": { "min": 6, "max": 16 },
      "wireGauge": { "min": 10, "max": 16 },
      "connector": "wire"
    },
    {
      "id": "motor-out",
      "name": "Motor Output",
      "type": "motor",
      "direction": "output",
      "wireGauge": { "min": 10, "max": 16 },
      "connector": "wire"
    },
    {
      "id": "can-1",
      "name": "CAN",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4"
    },
    {
      "id": "can-2",
      "name": "CAN",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4"
    },
    {
      "id": "expansion",
      "name": "Data Port",
      "type": "data",
      "direction": "bidirectional",
      "connector": "jst-ph-6"
    }
  ]
}
```

### 10.2 Power Distribution Hub

The PDH. Demonstrates device-level properties (the internal CAN termination switch), a mix of explicit ports and a port template (20 high current channels), and the `switchable` field on power outputs.

```json
{
  "schemaVersion": "1.0",
  "id": "rev-pdh",
  "name": "Power Distribution Hub",
  "manufacturer": "REV Robotics",
  "partNumber": "REV-11-1850",
  "category": "power-distribution",
  "properties": {
    "canTermination": {
      "type": "boolean",
      "default": false,
      "label": "Internal CAN Termination Enabled"
    }
  },
  "ports": [
    {
      "id": "power-in",
      "name": "Main Power Input",
      "type": "power",
      "direction": "input",
      "voltage": { "nominal": 12 },
      "wireGauge": { "min": 2, "max": 4 },
      "connector": null
    },
    {
      "id": "can-1",
      "name": "CAN",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4"
    },
    {
      "id": "can-2",
      "name": "CAN",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4"
    },
    {
      "id": "lc-1",
      "name": "Low Current Channel 1",
      "type": "power",
      "direction": "output",
      "current": { "max": 15 },
      "connector": null,
      "switchable": false
    },
    {
      "id": "lc-2",
      "name": "Low Current Channel 2",
      "type": "power",
      "direction": "output",
      "current": { "max": 15 },
      "connector": null,
      "switchable": false
    },
    {
      "id": "lc-3",
      "name": "Low Current Channel 3",
      "type": "power",
      "direction": "output",
      "current": { "max": 15 },
      "connector": null,
      "switchable": false
    },
    {
      "id": "lc-switchable",
      "name": "Low Current Channel (Switchable)",
      "type": "power",
      "direction": "output",
      "current": { "max": 15 },
      "connector": null,
      "switchable": true
    }
  ],
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
  ],
  "note": "Specific values (wire gauge ranges, low current channel limits, connector names) need verification against REV spec sheet."
}
```

### 10.3 RoboRIO 2

The robot controller. Demonstrates a device with many port types, multiple templates (PWM, DIO, analog, relay), device-level properties, and a port-level note for an unresolved detail.

```json
{
  "schemaVersion": "1.0",
  "id": "ni-roborio-2",
  "name": "RoboRIO 2",
  "manufacturer": "National Instruments",
  "partNumber": "REV-11-1856",
  "category": "robot-controller",
  "properties": {
    "canTermination": {
      "type": "boolean",
      "default": false,
      "label": "Internal CAN Termination Enabled"
    }
  },
  "ports": [
    {
      "id": "power-in",
      "name": "Power Input",
      "type": "power",
      "direction": "input",
      "voltage": { "min": 6, "max": 16 },
      "wireGauge": { "min": 18, "max": 22 },
      "connector": null
    },
    {
      "id": "can-1",
      "name": "CAN",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4"
    },
    {
      "id": "can-2",
      "name": "CAN",
      "type": "can",
      "direction": "bidirectional",
      "connector": "jst-ph-4"
    },
    {
      "id": "ethernet",
      "name": "Ethernet",
      "type": "ethernet",
      "direction": "bidirectional",
      "connector": "rj45"
    },
    {
      "id": "usb-a-0",
      "name": "USB-A 0",
      "type": "usb-a",
      "direction": "output",
      "connector": "usb-a"
    },
    {
      "id": "usb-a-1",
      "name": "USB-A 1",
      "type": "usb-a",
      "direction": "output",
      "connector": "usb-a"
    },
    {
      "id": "usb-b",
      "name": "USB-B",
      "type": "usb-b",
      "direction": "bidirectional",
      "connector": "usb-b",
      "note": "Likely programming only — verify if used during robot operation"
    },
    {
      "id": "mxp",
      "name": "MXP Expansion Port",
      "type": "mxp",
      "direction": "bidirectional",
      "connector": "mxp"
    }
  ],
  "portTemplates": [
    {
      "id": "pwm-{n}",
      "name": "PWM {n}",
      "type": "pwm",
      "direction": "output",
      "connector": "pwm-header",
      "count": 10,
      "indexStart": 0
    },
    {
      "id": "dio-{n}",
      "name": "DIO {n}",
      "type": "dio",
      "direction": "bidirectional",
      "connector": null,
      "count": 10,
      "indexStart": 0
    },
    {
      "id": "analog-{n}",
      "name": "Analog In {n}",
      "type": "analog-in",
      "direction": "input",
      "connector": null,
      "count": 4,
      "indexStart": 0
    },
    {
      "id": "relay-{n}",
      "name": "Relay {n}",
      "type": "relay",
      "direction": "output",
      "connector": null,
      "count": 4,
      "indexStart": 0
    }
  ]
}
```

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
