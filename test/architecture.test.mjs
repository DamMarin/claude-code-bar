// Architecture fitness test: functional core, imperative shell.
// core/ is pure (no I/O, no process state); io/ talks to the outside world;
// commands/ combine the two. Dependencies only point inward: commands → io → core.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const LAYERS = ["core", "io", "commands"];
const ALLOWED = { core: ["core"], io: ["io", "core"], commands: ["commands", "io", "core"] };

function sources(layer) {
  return readdirSync(join(SRC, layer))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => ({ file: `${layer}/${f}`, code: readFileSync(join(SRC, layer, f), "utf8") }));
}

function importsOf(code) {
  return [...code.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)]
    .map((m) => m[1] ?? m[2]);
}

// The layer a relative import lands in, e.g. "../io/git.mjs" from core → "io"
function targetLayer(fromLayer, specifier) {
  if (specifier.startsWith("./")) return fromLayer;
  const match = /^\.\.\/([^/]+)\//.exec(specifier);
  return match ? match[1] : null;
}

test("src/ holds only the three layers", () => {
  const dirs = readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assert.deepEqual(dirs, [...LAYERS].sort());
});

for (const layer of LAYERS) {
  test(`${layer}/ imports only from ${ALLOWED[layer].join(", ")}`, () => {
    for (const { file, code } of sources(layer)) {
      for (const specifier of importsOf(code)) {
        if (specifier.startsWith("node:")) continue;
        const target = targetLayer(layer, specifier);
        assert.ok(ALLOWED[layer].includes(target), `${file} imports ${specifier}`);
      }
    }
  });
}

test("core/ does no I/O and reads no process state", () => {
  for (const { file, code } of sources("core")) {
    const nodeImports = importsOf(code).filter((s) => s.startsWith("node:"));
    assert.deepEqual(nodeImports, [], `${file} imports ${nodeImports.join(", ")}`);
    // Ignore comments and strings that merely mention these names
    const body = code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
    for (const banned of ["process.", "console.", "fetch(", "require("]) {
      assert.ok(!body.includes(banned), `${file} uses ${banned}`);
    }
  }
});
