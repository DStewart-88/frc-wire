/**
 * Validates every device file in /devices against the device library schema.
 * Run with: npm run validate
 *
 * Exits non-zero if any device fails validation.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadDevice } from "../src/validator/loadDevice.js";

const devicesDir = path.join(import.meta.dirname, "..", "devices");
const files = (await readdir(devicesDir)).filter((f) => f.endsWith(".json"));

let hasErrors = false;

for (const file of files.sort()) {
  const result = await loadDevice(path.join(devicesDir, file));
  console.log(`\n${file}`);

  if (result.success) {
    console.log(`  OK (${result.device.ports.length} ports)`);
  } else {
    hasErrors = true;
    for (const e of result.errors) {
      console.log(`  ERROR  ${e.path}: ${e.message}`);
    }
  }

  for (const w of result.warnings) {
    console.log(`  WARN   ${w.path}: ${w.message}`);
  }
}

console.log("");
if (hasErrors) {
  console.error("Validation failed.");
  process.exit(1);
} else {
  console.log("All devices valid.");
}
