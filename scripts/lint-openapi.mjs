// Lints every OpenAPI spec with Redocly (DOC-01).
import { spawnSync } from "node:child_process";

import { OPENAPI_SPECS } from "./openapi-specs.mjs";

const files = OPENAPI_SPECS.map((name) => `public/assets/${name}.yaml`);
const { status } = spawnSync("npx", ["redocly", "lint", ...files], { stdio: "inherit" });
process.exit(status ?? 1);
