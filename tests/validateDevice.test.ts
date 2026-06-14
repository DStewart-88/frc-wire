import { describe, expect, it } from "vitest";
import { validateDevice } from "../src/validator/validateDevice.js";

const validDevice = {
  schemaVersion: "1.0",
  id: "test-device",
  name: "Test Device",
  manufacturer: "Test Co",
  partNumber: "TD-1",
  category: "sensor",
  ports: [
    {
      id: "power-in",
      name: "Power Input",
      type: "power",
      direction: "input",
      voltage: { min: 6, max: 16, nominal: 12 },
      wireGauge: { min: 18, max: 22 },
      connector: "wire",
    },
  ],
};

describe("validateDevice", () => {
  it("accepts a well-formed device", () => {
    const result = validateDevice(validDevice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.device.id).toBe("test-device");
      expect(result.device.ports).toHaveLength(1);
    }
  });

  it("rejects non-object input", () => {
    const result = validateDevice("not an object");
    expect(result.success).toBe(false);
  });

  it("rejects a device missing a required field", () => {
    const { id: _id, ...withoutId } = validDevice;
    const result = validateDevice(withoutId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "id",
          message: expect.stringContaining("Missing required field"),
        }),
      );
    }
  });

  it("rejects an invalid category", () => {
    const result = validateDevice({ ...validDevice, category: "spaceship" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "category",
          message: expect.stringContaining("Invalid category"),
        }),
      );
    }
  });

  it("rejects a device with neither ports nor portTemplates", () => {
    const { ports: _ports, ...withoutPorts } = validDevice;
    const result = validateDevice(withoutPorts);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('"ports" or "portTemplates"') }),
      );
    }
  });

  it("rejects a port with an invalid type", () => {
    const result = validateDevice({
      ...validDevice,
      ports: [{ id: "weird", name: "Weird", type: "laser", direction: "output", connector: null }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "ports[0].type",
          message: expect.stringContaining("Invalid port type"),
        }),
      );
    }
  });

  it("rejects a port missing the required connector field", () => {
    const result = validateDevice({
      ...validDevice,
      ports: [{ id: "p", name: "P", type: "power", direction: "input" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "ports[0].connector",
          message: expect.stringContaining("Missing required field"),
        }),
      );
    }
  });

  it("rejects a port template missing count and indexStart", () => {
    const result = validateDevice({
      ...validDevice,
      portTemplates: [
        { id: "ch-{n}", name: "Channel {n}", type: "power", direction: "output", connector: null },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "portTemplates[0].count",
          message: expect.stringContaining("Missing required field"),
        }),
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "portTemplates[0].indexStart",
          message: expect.stringContaining("Missing required field"),
        }),
      );
    }
  });

  it("rejects a port template whose id lacks the {n} placeholder", () => {
    const result = validateDevice({
      ...validDevice,
      portTemplates: [
        {
          id: "ch-fixed",
          name: "Channel {n}",
          type: "power",
          direction: "output",
          connector: null,
          count: 2,
          indexStart: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "portTemplates[0].id",
          message: expect.stringContaining("{n}"),
        }),
      );
    }
  });

  it("rejects duplicate port ids after template expansion", () => {
    const result = validateDevice({
      ...validDevice,
      ports: [
        { id: "ch-1", name: "Channel 1", type: "power", direction: "output", connector: null },
      ],
      portTemplates: [
        {
          id: "ch-{n}",
          name: "Channel {n}",
          type: "power",
          direction: "output",
          connector: null,
          count: 2,
          indexStart: 1,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('Duplicate port id "ch-1"') }),
      );
    }
  });

  it("rejects voltage ranges where min > max", () => {
    const result = validateDevice({
      ...validDevice,
      ports: [
        {
          id: "power-in",
          name: "Power Input",
          type: "power",
          direction: "input",
          voltage: { min: 20, max: 10 },
          connector: "wire",
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "ports[0].voltage",
          message: expect.stringContaining("voltage.min"),
        }),
      );
    }
  });

  it("warns on a non-empty note field but still succeeds", () => {
    const result = validateDevice({ ...validDevice, note: "Needs verification." });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          path: "note",
          message: expect.stringContaining("non-empty note"),
        }),
      );
    }
  });

  it("does not warn on an empty note field", () => {
    const result = validateDevice({ ...validDevice, note: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toHaveLength(0);
    }
  });

  it("validates device-level properties", () => {
    const result = validateDevice({
      ...validDevice,
      properties: {
        canTermination: {
          type: "boolean",
          default: false,
          label: "Internal CAN Termination Enabled",
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.device.properties?.canTermination).toEqual({
        type: "boolean",
        default: false,
        label: "Internal CAN Termination Enabled",
      });
    }
  });

  it("rejects a property whose default does not match its declared type", () => {
    const result = validateDevice({
      ...validDevice,
      properties: {
        canTermination: {
          type: "boolean",
          default: "false",
          label: "Internal CAN Termination Enabled",
        },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: "properties.canTermination.default" }),
      );
    }
  });
});
