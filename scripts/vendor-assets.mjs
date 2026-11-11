// Copies ReDoc's standalone bundle into public/vendor so the docs pages can
// load it from our own origin (no CDN in the CSP). Runs before dev and build.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = require.resolve("redoc/bundles/redoc.standalone.js");
mkdirSync("public/vendor", { recursive: true });
copyFileSync(source, "public/vendor/redoc.standalone.js");
console.log("Copied redoc.standalone.js to public/vendor");
