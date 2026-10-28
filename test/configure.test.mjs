import { test } from "node:test";
import assert from "node:assert/strict";
import { createMenu } from "../src/core/menu.mjs";
import { DEFAULT_OPTIONS, cloneOptions, parseOptions, serializeOptions } from "../src/core/options.mjs";

const plain = (lines) => lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
const press = (menu, ...keys) => keys.map((k) => (k === "S-Tab" ? menu.onKey("Tab", true) : menu.onKey(k))).at(-1);
const fresh = () => createMenu(cloneOptions(DEFAULT_OPTIONS), { version: "1.2.3" });

test("opens on Segments with every segment shown", () => {
  const text = plain(fresh().frame(80, 40));
  assert.match(text, /^ █▀▀ █   ▄▀█ █ █ █▀▄ █▀▀ {3}█▀▀ █▀█ █▀▄ █▀▀ {3}██▀ ▄▀█ █▀█\n/);
  assert.match(text, /█▀▄ {2}1\.2\.3 +no changes/);
  assert.match(text, /1 Segments/);
  assert.match(text, /● {2}Model/);
  assert.match(text, /┃ 🤖 Opus 4\.6/);
});

test("hide a segment and move another", () => {
  const menu = fresh();
  press(menu, "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", " ");
  press(menu, "ArrowDown", "m", "ArrowUp", "ArrowUp", "ArrowUp", "Enter");
  assert.deepEqual(serializeOptions(menu.options()), ["--hide=dir", "--order=model,git,context,duration,dir,cost,lines,update"]);
  assert.match(plain(menu.frame(80, 40)), /● 2 changes/);
});

test("Esc while moving puts the segment back", () => {
  const menu = fresh();
  press(menu, "ArrowDown", "m", "ArrowDown", "ArrowDown", "Escape");
  assert.deepEqual(menu.options().order, DEFAULT_OPTIONS.order);
});

test("themes are listed, previewed on focus and chosen with space", () => {
  const menu = fresh();
  press(menu, "2", "ArrowDown", "ArrowDown");
  const text = plain(menu.frame(80, 40));
  for (const name of ["Default", "Colorblind", "Ocean", "High contrast", "Mono", "None", "Custom"]) assert.match(text, new RegExp(name));
  assert.match(text, /Previewing it below/);
  assert.equal(menu.options().theme, "default");

  // The preview already uses Ocean's accent color on the model name
  assert.match(menu.frame(80, 40).join("\n"), /\x1b\[4;96mOpus 4\.6/);

  press(menu, " ");
  assert.equal(menu.options().theme, "ocean");
});

test("changing a color switches to Custom", () => {
  const menu = fresh();
  press(menu, "2", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowRight");
  assert.equal(menu.options().theme, "custom");
  assert.equal(menu.options().low, "yellow");
});

test("bar settings are disabled in the one-line layout", () => {
  const menu = fresh();
  press(menu, "4", "ArrowRight", "3", "ArrowRight");
  assert.equal(menu.options().bar, "shade");
  assert.match(plain(menu.frame(80, 40)), /Not shown in the one-line layout/);
});

test("reset one setting with r and everything with R", () => {
  const menu = fresh();
  press(menu, "3", "ArrowRight", "ArrowDown", "ArrowRight", "ArrowUp", "r");
  assert.equal(menu.options().bar, "shade");
  assert.equal(menu.options().barWidth, 12);
  press(menu, "R");
  assert.equal(menu.changes(), 0);
});

test("Enter saves, Esc asks before discarding", () => {
  const menu = fresh();
  assert.equal(press(menu, "Escape"), "quit");

  const edited = fresh();
  press(edited, "4", "ArrowDown", "ArrowDown", "ArrowRight");
  assert.equal(press(edited, "Escape"), null);
  assert.match(plain(edited.frame(80, 40)), /Discard 1 change\?/);
  assert.equal(press(edited, "n"), null);
  assert.equal(press(edited, "Escape", "y"), "quit");
  assert.equal(fresh().onKey("Enter"), "save");
});

test("starts from the options in the current command", () => {
  const { options } = parseOptions(["--theme=mono", "--hide=dir"]);
  const menu = createMenu(options);
  assert.equal(menu.changes(), 0);
  assert.match(plain(menu.frame(80, 40)), /○ {2}Directory/);
});

test("small terminals drop the logo before the preview", () => {
  const rowsWithLogo = fresh().frame(80, 40).length;

  const short = plain(fresh().frame(80, rowsWithLogo - 1));
  assert.doesNotMatch(short, /█▀▀/);
  assert.match(short, /^ claude-code-bar 1\.2\.3/);
  assert.doesNotMatch(short, /more lines/);

  const narrow = plain(fresh().frame(50, 40));
  assert.match(narrow, /^ claude-code-bar 1\.2\.3/);

  const tiny = plain(fresh().frame(80, 20));
  assert.match(tiny, /more lines, press p to show them/);
});

test("cost and lines start hidden and are shown with space", () => {
  const menu = fresh();
  assert.match(plain(menu.frame(80, 40)), /Preset +‹ Default ›/);
  assert.match(plain(menu.frame(80, 40)), /○ {2}Cost/);
  press(menu, ...Array(6).fill("ArrowDown"), " ", "ArrowDown", " ");
  assert.deepEqual(serializeOptions(menu.options()), ["--add=cost,lines"]);
  assert.match(plain(menu.frame(80, 40)), /┃ .* \$0\.42 │ \+156 −23/);
  press(menu, "r");
  assert.deepEqual(serializeOptions(menu.options()), ["--add=cost"]);
});

test("the Layout tab sets how context is counted", () => {
  const menu = fresh();
  press(menu, "4", "ArrowDown", "ArrowRight");
  assert.deepEqual(serializeOptions(menu.options()), ["--context=tokens"]);
  assert.match(plain(menu.frame(80, 40)), /🧠 60k\/200k/);
});
