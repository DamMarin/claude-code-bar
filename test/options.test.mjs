import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OPTIONS, parseOptions, serializeOptions } from "../src/core/options.mjs";

test("no flags gives the defaults", () => {
  const { options, errors } = parseOptions([]);
  assert.deepEqual(errors, []);
  assert.deepEqual(options, { ...DEFAULT_OPTIONS, hidden: [], order: [...DEFAULT_OPTIONS.order] });
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
  assert.deepEqual(options.hidden, ["dir", "sonnet"]);
  assert.equal(options.layout, "compact");
  assert.deepEqual(options.order, ["git", "model", "context", "duration", "dir", "update"]);
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
  assert.deepEqual(options.hidden, []);
  assert.equal(options.bar, "dots");
});

test("serialize and parse round-trip", () => {
  const flags = [
    "--colors=low:cyan,medium:yellow,high:bright-red,accent:magenta", "--thresholds=40,85", "--no-emoji",
    "--hide=update,extra", "--layout=compact", "--order=dir,git,model,context,duration,update",
    "--bar=line", "--bar-width=15", "--separator=slash", "--show=left", "--reset=countdown",
  ];
  const { options, errors } = parseOptions(flags);
  assert.deepEqual(errors, []);
  assert.deepEqual(serializeOptions(options), flags);
});
