import { describe, expect, it } from "vitest";
import { expandPortTemplates } from "../src/validator/expandTemplates.js";
import type { PortTemplate } from "../src/types/device.js";

describe("expandPortTemplates", () => {
  it("expands a template into the correct number of ports with correct ids", () => {
    const template: PortTemplate = {
      id: "hc-{n}",
      name: "High Current Channel {n}",
      type: "power",
      direction: "output",
      current: { max: 40 },
      connector: "wago-lever",
      count: 20,
      indexStart: 0,
    };

    const ports = expandPortTemplates([template]);

    expect(ports).toHaveLength(20);
    expect(ports[0]?.id).toBe("hc-0");
    expect(ports[0]?.name).toBe("High Current Channel 0");
    expect(ports[19]?.id).toBe("hc-19");
    expect(ports[19]?.name).toBe("High Current Channel 19");
  });

  it("respects a non-zero indexStart", () => {
    const template: PortTemplate = {
      id: "ch-{n}",
      name: "Channel {n}",
      type: "power",
      direction: "output",
      connector: null,
      count: 3,
      indexStart: 1,
    };

    const ports = expandPortTemplates([template]);

    expect(ports.map((p) => p.id)).toEqual(["ch-1", "ch-2", "ch-3"]);
    expect(ports.map((p) => p.name)).toEqual(["Channel 1", "Channel 2", "Channel 3"]);
  });

  it("carries over shared fields to every expanded port", () => {
    const template: PortTemplate = {
      id: "pwm-{n}",
      name: "PWM {n}",
      type: "pwm",
      direction: "output",
      connector: "pwm-header",
      count: 2,
      indexStart: 0,
    };

    const ports = expandPortTemplates([template]);

    for (const port of ports) {
      expect(port.type).toBe("pwm");
      expect(port.direction).toBe("output");
      expect(port.connector).toBe("pwm-header");
    }
  });

  it("expands multiple templates independently", () => {
    const templates: PortTemplate[] = [
      {
        id: "a-{n}",
        name: "A {n}",
        type: "dio",
        direction: "bidirectional",
        connector: null,
        count: 2,
        indexStart: 0,
      },
      {
        id: "b-{n}",
        name: "B {n}",
        type: "analog-in",
        direction: "input",
        connector: null,
        count: 2,
        indexStart: 0,
      },
    ];

    const ports = expandPortTemplates(templates);

    expect(ports.map((p) => p.id)).toEqual(["a-0", "a-1", "b-0", "b-1"]);
  });

  it("returns an empty array for no templates", () => {
    expect(expandPortTemplates([])).toEqual([]);
  });
});
