// Generates each spec's JSON from its YAML so the two downloads can never
// disagree (DOC-01). `--check` fails instead of writing, for CI.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { OPENAPI_SPECS } from "./openapi-specs.mjs";

const assets = resolve(dirname(fileURLToPath(import.meta.url)), "../public/assets");
const checkOnly = process.argv.includes("--check");
let drifted = false;

for (const name of OPENAPI_SPECS) {
  const json = `${JSON.stringify(parse(readFileSync(resolve(assets, `${name}.yaml`), "utf8")), null, 2)}\n`;
  const jsonPath = resolve(assets, `${name}.json`);
  if (checkOnly) {
    if (readFileSync(jsonPath, "utf8") !== json) {
      drifted = true;
      console.error(`${name}.json is out of date: run \`npm run openapi:sync\``);
    }
    continue;
  }
  writeFileSync(jsonPath, json);
  console.log(`Synced ${name}.yaml → ${name}.json`);
}

if (drifted) process.exit(1);
