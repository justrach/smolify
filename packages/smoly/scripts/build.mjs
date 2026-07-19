import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const output = resolve(packageRoot, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const result = await Bun.build({
  entrypoints: [resolve(packageRoot, "src/cli.ts"), resolve(packageRoot, "src/installer.ts")],
  outdir: output,
  target: "node",
  format: "esm",
  minify: false,
  sourcemap: "external",
  banner: "#!/usr/bin/env node",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await cp(resolve(repositoryRoot, "skills/smolify-api-docs"), resolve(output, "skill"), { recursive: true });
await chmod(resolve(output, "cli.js"), 0o755);
