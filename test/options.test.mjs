import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OPTIONS, parseOptions, serializeOptions } from "../src/core/options.mjs";

test("no flags gives the defaults", () => {
  const { options, errors } = parseOptions([]);
  assert.deepEqual(errors, []);
  assert.deepEqual(options, { ...DEFAULT_OPTIONS, hidden: ["cost", "lines"], order: [...DEFAULT_OPTIONS.order] });
  assert.deepEqual(serializeOptions(options), []);
});

test("parses every display flag", () => {
  const { options, errors } = parseOptions([
    "--theme=ocean", "--thresholds=60,90", "--no-emoji", "--hide=sonnet,dir", "--layout=compact",
    "--order=git,model", "--bar=braille", "--bar-width=12", "--separator=dot", "--show=left", "--reset=countdown",
  ]);
  assert.deepEqual(errors, []);
  assert.equal(options.theme, "ocean");
  assert.equal(options.accent, "bright-cyan");
  assert.deepEqual([options.thMedium, options.thHigh], [60, 90]);
  assert.equal(options.emoji, false);
  assert.deepEqual(options.hidden, ["dir", "cost", "lines", "sonnet"]);
  assert.equal(options.layout, "compact");
  assert.deepEqual(options.order, ["git", "model", "context", "duration", "dir", "cost", "lines", "update"]);
  assert.equal(options.bar, "braille");
  assert.equal(options.barWidth, 12);
  assert.equal(options.sep, "dot");
  assert.equal(options.left, true);
  assert.equal(options.countdown, true);
});

test("--colors starts from the current theme and switches to custom", () => {
  const { options } = parseOptions(["--theme=ocean", "--colors=high:bright-red"]);
  assert.equal(options.theme, "custom");
  assert.deepEqual([options.low, options.medium, options.high, options.accent], ["cyan", "blue", "bright-red", "bright-cyan"]);

  // Colorless themes start custom colors from the default palette, not from "none"
  const fromMono = parseOptions(["--theme=mono", "--colors=accent:magenta"]).options;
  assert.deepEqual([fromMono.low, fromMono.medium, fromMono.high, fromMono.accent], ["green", "yellow", "red", "magenta"]);
});

test("--no-color is the none theme", () => {
  assert.equal(parseOptions(["--no-color"]).options.theme, "none");
});

test("reports bad flags and keeps the rest", () => {
  const { options, errors } = parseOptions([
    "--theme=neon", "--hide=dir,clock", "--bar-width=2", "--thresholds=80,50", "--layout",
    "--no-emoji=yes", "--colors=low:pink", "--colors=glow:red", "stray", "--bar=dots",
  ]);
  assert.equal(errors.length, 9);
  assert.match(errors[0], /--theme: unknown value "neon"/);
  assert.match(errors[1], /--hide: unknown name "clock"/);
  assert.match(errors[2], /--bar-width/);
  assert.match(errors[3], /--thresholds/);
  assert.match(errors[4], /--layout needs a value/);
  assert.match(errors[5], /--no-emoji does not take a value/);
  assert.match(errors[6], /unknown color "pink"/);
  assert.match(errors[7], /unknown role "glow"/);
  assert.match(errors[8], /Unknown option: stray/);
  assert.equal(options.theme, "default");
  assert.deepEqual(options.hidden, ["cost", "lines"]);
  assert.equal(options.bar, "dots");
});

test("serialize and parse round-trip", () => {
  const flags = [
    "--colors=low:cyan,medium:yellow,high:bright-red,accent:magenta", "--thresholds=40,85", "--no-emoji",
    "--hide=update,extra", "--add=cost", "--layout=compact", "--order=dir,git,model,context,duration,cost,lines,update",
    "--bar=line", "--bar-width=15", "--separator=slash", "--show=left", "--reset=countdown", "--context=both",
  ];
  const { options, errors } = parseOptions(flags);
  assert.deepEqual(errors, []);
  assert.deepEqual(serializeOptions(options), flags);
});

test("cost and lines stay hidden until --add, in any flag order", () => {
  assert.deepEqual(parseOptions(["--hide=dir"]).options.hidden, ["dir", "cost", "lines"]);
  assert.deepEqual(parseOptions(["--add=lines", "--hide=dir"]).options.hidden, ["dir", "cost"]);
  assert.deepEqual(parseOptions(["--hide=dir", "--add=cost,lines"]).options.hidden, ["dir"]);
  assert.deepEqual(serializeOptions(parseOptions(["--add=lines,cost"]).options), ["--add=cost,lines"]);
  assert.match(parseOptions(["--add=dir"]).errors[0], /--add: unknown name "dir". Use: cost, lines/);
  assert.match(parseOptions(["--context=words"]).errors[0], /--context: unknown value "words"/);
});

test("an order written before cost and lines existed puts them before update", () => {
  assert.deepEqual(parseOptions(["--order=git,model"]).options.order, ["git", "model", "context", "duration", "dir", "cost", "lines", "update"]);
});
