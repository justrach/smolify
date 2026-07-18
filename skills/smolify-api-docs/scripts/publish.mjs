import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const input = process.argv[2];
const token = process.env.SMOLIFY_PUBLISH_TOKEN;
const project = process.env.SMOLIFY_PROJECT;
const endpoint = (process.env.SMOLIFY_ENDPOINT || "https://smol.ly").replace(/\/$/, "");

if (!input) throw new Error("Usage: publish.mjs <bundle.json>");
if (!token) throw new Error("SMOLIFY_PUBLISH_TOKEN is required");
if (!project) throw new Error("SMOLIFY_PROJECT is required");

const body = await readFile(resolve(input), "utf8");
const response = await fetch(`${endpoint}/api/v1/projects/${encodeURIComponent(project)}/deployments`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body,
});

const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Publish failed (${response.status}): ${result.error || "unknown error"}`);
console.log(`Published ${result.pages} pages`);
console.log(`Deployment: ${result.deploymentId}`);
console.log(`URL: ${result.url}`);
