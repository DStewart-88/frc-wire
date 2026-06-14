import type { Port, PortTemplate } from "../types/device.js";

/**
 * Expands port templates into individually addressable ports, per
 * docs/device-library-schema.md section 5. `{n}` in `id` and `name` is
 * replaced with each index from `indexStart` to `indexStart + count - 1`.
 */
export function expandPortTemplates(templates: PortTemplate[]): Port[] {
  const expanded: Port[] = [];

  for (const template of templates) {
    const { count, indexStart, id, name, ...rest } = template;

    for (let i = 0; i < count; i++) {
      const index = indexStart + i;
      expanded.push({
        ...rest,
        id: id.replaceAll("{n}", String(index)),
        name: name.replaceAll("{n}", String(index)),
      });
    }
  }

  return expanded;
}
