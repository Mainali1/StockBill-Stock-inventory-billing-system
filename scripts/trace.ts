import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTraceRows, findMissingTests, renderTraceMarkdown } from "./lib/trace";

/**
 * Regenerates `docs/requirements-trace.md`: one row per requirement ID in
 * `docs/SPEC.md` with the test files whose test names start with that ID.
 * Exits with a failure when a requirement that needs a test has none.
 */
const root = process.cwd();
const rows = buildTraceRows(root);
const target = join(root, "docs", "requirements-trace.md");
writeFileSync(target, renderTraceMarkdown(rows), "utf8");
console.log(`Wrote ${target} (${rows.length} requirements)`);

const missing = findMissingTests(rows);
if (missing.length > 0) {
  console.error(`Requirements without a test: ${missing.join(", ")}`);
  process.exitCode = 1;
}
