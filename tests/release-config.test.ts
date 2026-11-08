import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("REL-6: release configuration", () => {
  it("REL-6: every npm script used in the workflows exists in package.json", () => {
    const pkgPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const scripts = pkg.scripts || {};

    const workflowsDir = path.resolve(__dirname, "../.github/workflows");
    const workflowFiles = fs
      .readdirSync(workflowsDir)
      .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

    expect(workflowFiles.length).toBeGreaterThan(0);

    const scriptRegex = /npm\s+run\s+([a-zA-Z0-9_:-]+)/g;
    const foundScripts = new Set<string>();

    for (const file of workflowFiles) {
      const content = fs.readFileSync(path.join(workflowsDir, file), "utf-8");
      let match: RegExpExecArray | null;
      while ((match = scriptRegex.exec(content)) !== null) {
        if (match[1]) {
          foundScripts.add(match[1]);
        }
      }
    }

    expect(foundScripts.size).toBeGreaterThan(0);

    for (const scriptName of foundScripts) {
      expect(
        scripts,
        `Workflow references "npm run ${scriptName}" but it is missing from package.json scripts`
      ).toHaveProperty(scriptName);
    }
  });

  it("REL-6: electron-builder.yml exists and unpacks native modules", () => {
    const ebPath = path.resolve(__dirname, "../electron-builder.yml");
    expect(fs.existsSync(ebPath)).toBe(true);

    const content = fs.readFileSync(ebPath, "utf-8");
    expect(content).toContain("asarUnpack:");
    expect(content).toMatch(/asarUnpack:\s*\n\s*-\s*["']?\*\*\/\*\.node["']?/);
  });
});

describe("REL-2: versioning configuration", () => {
  it("REL-2: package.json version is 0.0.0", () => {
    const pkgPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.version).toBe("0.0.0");
  });

  it("REL-2: release workflow stamps version without committing to git", () => {
    const releaseWfPath = path.resolve(__dirname, "../.github/workflows/release.yml");
    expect(fs.existsSync(releaseWfPath)).toBe(true);
    const content = fs.readFileSync(releaseWfPath, "utf-8");

    // Must compute tag with conventional commits
    expect(content).toContain("mathieudutour/github-tag-action");
    expect(content).toContain("tag_prefix: v");

    // Must stamp version using --no-git-tag-version so repository never commits version bump
    expect(content).toContain("npm version");
    expect(content).toContain("--no-git-tag-version");
  });
});

describe("REL-3: artifact name pattern & targets", () => {
  it("REL-3: artifact name pattern matches StockBill-<version>-<os>-<arch>.<ext>", () => {
    const ebPath = path.resolve(__dirname, "../electron-builder.yml");
    const content = fs.readFileSync(ebPath, "utf-8");

    expect(content).toMatch(/productName:\s*StockBill/);
    expect(content).toMatch(/artifactName:\s*\${productName}-\${version}-\${os}-\${arch}\.\${ext}/);
  });

  it("REL-3: target platforms cover windows nsis, linux appimage and macos dmg", () => {
    const ebPath = path.resolve(__dirname, "../electron-builder.yml");
    const content = fs.readFileSync(ebPath, "utf-8");

    // Windows target
    expect(content).toMatch(/win:[\s\S]*?target:[\s\S]*?nsis/);
    // Linux target
    expect(content).toMatch(/linux:[\s\S]*?target:[\s\S]*?AppImage/);
    // Mac target
    expect(content).toMatch(/mac:[\s\S]*?target:[\s\S]*?dmg/);
  });
});

describe("REL-5: README Download section & workflow badge", () => {
  it("REL-5: README has Download section linking to releases with unsigned installer instructions and badge", () => {
    const readmePath = path.resolve(__dirname, "../README.md");
    expect(fs.existsSync(readmePath)).toBe(true);
    const content = fs.readFileSync(readmePath, "utf-8");

    // Must have Download section
    expect(content).toMatch(/## Download/);

    // Must have release workflow badge
    expect(content).toMatch(/actions\/workflows\/release\.yml\/badge\.svg/);

    // Must link to releases
    expect(content).toMatch(/releases/i);

    // Platform descriptions and unsigned notes
    expect(content).toMatch(/Windows/i);
    expect(content).toMatch(/Linux/i);
    expect(content).toMatch(/macOS/i);
    expect(content).toMatch(/More info/i);
    expect(content).toMatch(/Run anyway/i);
    expect(content).toMatch(/Open/i);
  });
});

describe("REL-7: release process documentation", () => {
  it("REL-7: docs/release-process.md exists with flowchart, bump table and versioning rationale", () => {
    const docPath = path.resolve(__dirname, "../docs/release-process.md");
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, "utf-8");

    // Flowchart
    expect(content).toMatch(/```mermaid\s*\n\s*flowchart TD/);
    expect(content).toContain("PR[Pull Request opened or updated]");
    expect(content).toContain("Build Matrix");
    expect(content).toContain("Publish GitHub Release");

    // Table of commit types
    expect(content).toContain("feat");
    expect(content).toContain("fix");
    expect(content).toContain("BREAKING CHANGE");
    expect(content).toContain("Minor");
    expect(content).toContain("Patch");
    expect(content).toContain("Major");

    // Rationale on never committing version bump
    expect(content).toMatch(/Why Version Bumps Are Never Committed/i);
    expect(content).toContain("--no-git-tag-version");
  });
});
