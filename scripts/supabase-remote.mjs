#!/usr/bin/env node
// Runs Supabase CLI database commands against a hosted Supabase project,
// using the connection string in .env.local (or the environment).
//
//   npm run db:push             apply pending migrations in supabase/migrations
//   npm run db:push -- --dry-run   show what would be applied, change nothing
//   npm run db:migrations       list migrations applied locally and remotely
//
// Needs SUPABASE_DB_URL: the Postgres connection string from the Supabase
// dashboard (Connect → Session pooler), with the database password in it.
// See .env.example.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const commands = {
  push: ["db", "push"],
  list: ["migration", "list"],
};

const [command, ...extraArgs] = process.argv.slice(2);
if (!command || !(command in commands)) {
  fail(`Usage: node scripts/supabase-remote.mjs <${Object.keys(commands).join("|")}> [options]`);
}

// Variables already set in the environment win over the files, so CI can
// pass SUPABASE_DB_URL directly.
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

const dbUrl = process.env.SUPABASE_DB_URL?.trim();
if (!dbUrl) {
  fail(
    [
      "SUPABASE_DB_URL is not set.",
      "",
      "Add it to .env.local. In the Supabase dashboard open your project, choose Connect,",
      "and copy the Session pooler connection string, replacing [YOUR-PASSWORD] with the",
      "database password. For example:",
      "",
      "  SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres",
    ].join("\n"),
  );
}

let parsed;
try {
  parsed = new URL(dbUrl);
} catch {
  fail(
    "SUPABASE_DB_URL is not a valid URL. If the password contains characters such as @, # or /, percent-encode them.",
  );
}
if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
  fail("SUPABASE_DB_URL must start with postgresql://");
}
if (parsed.password === "" || parsed.password.includes("YOUR-PASSWORD")) {
  fail("SUPABASE_DB_URL has no database password in it.");
}
if (parsed.port === "6543") {
  console.warn(
    "Warning: port 6543 is the transaction pooler. Migrations are more reliable over the session pooler (port 5432) or a direct connection.\n",
  );
}

// Show where we are pushing, never the password.
console.log(`Supabase database: ${parsed.username}@${parsed.hostname}:${parsed.port || "5432"}`);

const cli = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);
if (!existsSync(cli)) fail("The Supabase CLI isn't installed. Run `npm install` first.");

const result = spawnSync(cli, [...commands[command], "--db-url", dbUrl, ...extraArgs], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

function fail(message) {
  console.error(message);
  process.exit(1);
}
