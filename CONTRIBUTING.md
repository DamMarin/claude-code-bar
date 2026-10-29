# Contributing

Thanks for helping with claude-code-bar. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/DamMarin/claude-code-bar/issues/new). Include:

* what you expected and what you saw (a screenshot of the bar helps)
* the version (`claude-code-bar --version`), your OS, terminal and Node version
* the `statusLine` command from `~/.claude/settings.json`, so the options are known

Check the README's [Troubleshooting](README.md#-troubleshooting) section first; it covers the
common setup problems.

**Security issues are different:** don't open a public issue. Follow [SECURITY.md](SECURITY.md)
and report them privately.

## Suggesting a feature

Open an [issue](https://github.com/DamMarin/claude-code-bar/issues/new) that describes what you
want to see and why. For a larger change, agree on the approach in the issue before writing
the code.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make the change, with tests (see below).
3. Run `npm run lint` and `npm test`. Both must pass.
4. Add a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for any change users
   will notice.
5. Open a pull request against `main`. CI lints and tests it on Node 22, 24 and 26, on Linux
   and macOS, and it is merged only when every check passes.

Requirements for a change to be accepted:

* **Tests.** New functionality and bug fixes come with tests in `test/`, using the built-in
  `node --test` runner. A bug fix should include a test that fails without it.
* **No dependencies.** claude-code-bar has zero runtime and development dependencies, and no
  lockfile. Use Node's built-in modules.
* **Architecture.** `src/core` is pure (no I/O); file, process and network access belongs in
  `src/io`. `test/architecture.test.mjs` checks this.
* **Never break the bar.** The status line must not crash or print errors to stdout; a
  failure shows less, not nothing.
* **Code style.** Match the surrounding code. The linter is [oxlint](https://oxc.rs/) with the
  rules in `.oxlintrc.json`.
* **Documentation.** A new or changed option is documented in the README and in `--help`.

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT license](LICENSE).
