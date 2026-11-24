import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDatabaseWith } from "../src/main/db/open";
import { readMigrationsFromDisk } from "../scripts/lib/migrations";
import {
  buildTraceRows,
  findMissingTests,
  parseRequirements,
  renderTraceMarkdown,
} from "../scripts/lib/trace";

const root = path.resolve(__dirname, "..");
const docs = (name: string): string => fs.readFileSync(path.join(root, "docs", name), "utf8");

function migratedDatabase() {
  return openDatabaseWith(":memory:", readMigrationsFromDisk());
}

/** Reads `table_name { TYPE column [PK|UK|FK] ... }` blocks from the Mermaid ER diagram. */
function parseErDiagram(markdown: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const block = /^\s{4}(\w+) \{\n([\s\S]*?)^\s{4}\}/gm;
  for (const match of markdown.matchAll(block)) {
    const name = match[1];
    const body = match[2];
    if (name === undefined || body === undefined) continue;
    const columns = body
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 2)
      .map((parts) => parts[1] as string);
    tables.set(name, columns);
  }
  return tables;
}

describe("DOCS: schema documentation", () => {
  it("DOCS: docs/schema.sql matches the migrated database", () => {
    const db = migratedDatabase();
    const rows = db
      .prepare(
        `SELECT sql FROM sqlite_master
         WHERE type IN ('table', 'index')
           AND name NOT LIKE 'sqlite_%'
           AND name <> 'schema_migrations'
         ORDER BY (type = 'index'), name`,
      )
      .all() as { sql: string | null }[];
    db.close();

    const expected =
      rows
        .map((row) => row.sql)
        .filter((sql): sql is string => sql !== null)
        .map((sql) => {
          const trimmed = sql.trim();
          return trimmed.endsWith(";") ? trimmed : `${trimmed};`;
        })
        .join("\n\n") + "\n";

    // If this fails, run `npm run schema:dump` and commit docs/schema.sql.
    expect(docs("schema.sql")).toBe(expected);
  });

  it("DOCS: the ER diagram lists the same tables and columns as the database", () => {
    const db = migratedDatabase();
    const tableRows = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'
         ORDER BY name`,
      )
      .all() as { name: string }[];

    const actual = new Map<string, string[]>();
    for (const { name } of tableRows) {
      const columns = db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[];
      actual.set(
        name,
        columns.map((column) => column.name),
      );
    }
    db.close();

    const diagram = parseErDiagram(docs("er-diagram.md"));

    expect([...diagram.keys()].sort()).toEqual([...actual.keys()].sort());
    for (const [table, columns] of actual) {
      expect(diagram.get(table)?.slice().sort(), `columns of ${table}`).toEqual(
        columns.slice().sort(),
      );
    }
  });

  it("DOCS: every relationship in the ER diagram names two real tables", () => {
    const diagram = parseErDiagram(docs("er-diagram.md"));
    const relationLines = docs("er-diagram.md")
      .split("\n")
      .filter((line) => /^\s{4}\w+\s+[|}o][|o]--[|o][|{o]\s+\w+\s*:/.test(line));

    expect(relationLines.length).toBeGreaterThanOrEqual(6);
    for (const line of relationLines) {
      const [left, right] = [/^\s*(\w+)/.exec(line)?.[1], /\s(\w+)\s*:/.exec(line)?.[1]];
      expect(diagram.has(left ?? ""), `${left} in "${line.trim()}"`).toBe(true);
      expect(diagram.has(right ?? ""), `${right} in "${line.trim()}"`).toBe(true);
    }
  });
});

describe("DOCS: requirements trace", () => {
  it("DOCS: every requirement that needs a test has at least one", () => {
    const rows = buildTraceRows(root);
    expect(rows.length).toBeGreaterThan(30);
    expect(findMissingTests(rows)).toEqual([]);
  });

  it("DOCS: docs/requirements-trace.md is up to date", () => {
    // If this fails, run `npm run trace` and commit docs/requirements-trace.md.
    expect(docs("requirements-trace.md")).toBe(renderTraceMarkdown(buildTraceRows(root)));
  });

  it("DOCS: every requirement ID in the spec is unique", () => {
    const ids = parseRequirements(docs("SPEC.md")).map((requirement) => requirement.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DOCS: diagram documents", () => {
  const files: [string, RegExp][] = [
    ["er-diagram.md", /```mermaid\s+erDiagram/],
    ["use-case.md", /```mermaid\s+flowchart/],
    ["architecture.md", /```mermaid\s+flowchart/],
    ["gantt.md", /```mermaid\s+gantt/],
  ];

  for (const [file, diagramStart] of files) {
    it(`DOCS: ${file} exists and contains a Mermaid diagram`, () => {
      expect(docs(file)).toMatch(diagramStart);
    });
  }

  it("DOCS: the use-case diagram mentions every feature prefix of the spec", () => {
    const useCases = docs("use-case.md");
    const prefixes = new Set(
      parseRequirements(docs("SPEC.md"))
        .map((requirement) => requirement.id.split("-")[0])
        .filter((prefix) => prefix !== "REL"),
    );
    for (const prefix of prefixes) {
      expect(useCases, `${prefix} in use-case.md`).toContain(`${prefix}-1`);
    }
  });
});
