// Zips each agent skill in skills/<name>/ into public/assets/<name>-skill.zip
// (DOC-03). Run by hand after editing a skill: `npm run skills:package`.
import { createWriteStream, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = resolve(root, "skills");
const outputDir = resolve(root, "public/assets");

function packageSkill(name) {
  const output = resolve(outputDir, `${name}-skill.zip`);
  return new Promise((done, fail) => {
    const stream = createWriteStream(output);
    const archive = archiver.ZipArchive
      ? new archiver.ZipArchive({ zlib: { level: 9 } })
      : archiver("zip", { zlib: { level: 9 } });
    archive.on("error", fail);
    stream.on("close", () => {
      console.log(`Packaged ${name} → ${output} (${archive.pointer()} bytes)`);
      done();
    });
    archive.pipe(stream);
    archive.directory(resolve(skillsDir, name), name);
    archive.finalize();
  });
}

const target = process.argv[2];
const skills = target
  ? [target]
  : readdirSync(skillsDir).filter((name) => statSync(resolve(skillsDir, name)).isDirectory());
for (const skill of skills) await packageSkill(skill);
