# Changelog

All notable changes to claude-code-bar are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows
[Semantic Versioning](https://semver.org/) from 1.0.0 on.

The release workflow publishes a version's section below as its GitHub release notes,
so every release needs one.

## [Unreleased]

### Added
- The git segment shows commits ahead of and behind the upstream: `main* ⇡2⇣1`.
- `--context=tokens` shows the context as tokens out of the window size (`46k/200k`), and `--context=both` shows both (`30% (46k/200k)`). The percentage stays the default.
- Two segments that are off by default, turned on with `--add` or in `--config`: `cost`, the estimated session cost Claude Code reports (`$0.42`, at API list prices, not what a subscription bills), and `lines`, the lines added and removed (`+156 −23`). `--hide` lists keep them off, so no existing bar changes.
- `--config` has a Default preset (everything except the opt-in segments) next to Full, Minimal and Limits only.
- The README lists everything claude-code-bar accesses (environment variables, files, programs, network), so package scanner alerts such as Socket's can be checked against it, and shows an npm provenance badge.
- `--install` and `--config` warn when the statusLine runs claude-code-bar through npx, pnpm or yarn, which resolve the package on every refresh (0.2–0.6 s, against 0.03 s installed). The README recommends a global install.

### Changed
- Git info comes from one `git status --porcelain=v2 --branch`, run without a shell, instead of two or three commands through one.
- The login token is read from the macOS keychain (`security`) and the Linux secret store (`secret-tool`) without a shell in between. claude-code-bar no longer runs anything through a shell.

## [1.1.0] - 2026-10-24

**Requires Node 22 or newer.** 1.0.0 ran on Node 18; Node 18 and 20 are past end of life.

### Added
- The bar refreshes every minute while the session is idle: `--install` sets `refreshInterval: 60` on the statusLine, so reset countdowns and the limits stay current.
- Commands that run claude-code-bar through a package runner are recognized: `npx claude-code-bar@latest`, `bunx`, `pnpm dlx`, `yarn dlx`, with or without a version. `--install`, `--config` and `--uninstall` keep the runner and change only the options.
- Quoted program paths with spaces and shell syntax after the options (`2>/dev/null`) survive `--install` and `--config`.
- `npm run lint`: oxlint with its `correctness` and `suspicious` rules, run through `npx` at a pinned version, so the project still has no dependencies. CI lints, and `npm version` lints before it tests.
- Prereleases (`v1.2.0-beta.1`) publish under their own npm dist-tag and are marked as prereleases on GitHub.

### Changed
- Node 22 or newer is required (`engines`); CI runs on Node 22, 24 and 26.
- The context segment shows `–` instead of `0%` until Claude Code reports the context size, early in a session.
- `--install`, `--uninstall` and `--config` report unexpected errors and exit with code 1 instead of exiting silently. The status bar itself still never prints errors.
- `--install` checks the program the statusLine command really runs (`claude-code-bar`, or `npx`, `pnpm`, `node`, …), in Node rather than with `which`. The check works on Windows and no longer warns about custom commands that work.
- `~/.claude/settings.json` is rewritten with its own indent, final newline and permissions, and the other statusLine fields (`padding`, `refreshInterval`) are kept.
- The usage API is left alone for an hour after a 404 or 410. The README notes that the endpoint is undocumented and may change.

### Fixed
- The git branch disappeared when `git status` had more than 64 KB of output (about 1500 changed or untracked files). A large status now counts as dirty, and a slow one only drops the `*`.
- Rate limit windows Claude Code leaves out were never filled from the usage API once it sent any rate limits, so the Sonnet 7-day row showed until the session's first response and then vanished. Every shown window that stdin leaves empty is now fetched, with one request.
- The usage cache was shared across accounts: after logging in with another account, the bar showed the previous one's limits for up to a minute. The cache is now tied to the credentials in use.
- A symlinked `~/.claude/settings.json` (dotfiles) was replaced by a regular file; it is now written through.
- Escape sequences in a branch, folder, model or version name reached the terminal. They are stripped, and the branch sanitizer's dead second regex is gone.
- `--config` left the terminal in raw mode on the alternate screen when killed (SIGTERM) or hung up (SIGHUP).
- The update check wrote its cache without the symlink check and 0600 mode the other cache files use.
- `package.json` listed `status-bar` twice and carried a no-op `"exports": null`.

### Tests
- 96 tests, from 54: the usage API (retry-after, 404, oversized and invalid answers), the update check and its background process, the `--config` menu driven through stand-in terminal streams, package runner commands, symlinks, file layout and permissions. None of them touch the network.

## [1.0.0] - 2026-10-24

First stable release. Display options (`--theme`, `--colors`, `--thresholds`, `--hide`, `--order`, `--layout`, `--bar`, `--bar-width`, `--separator`, `--show`, `--reset`, `--no-emoji`, `--no-color`), six themes, the interactive `--config` menu with a live preview, `--help`, hardened install/uninstall, caching and formatting, a `node --test` suite with CI, and Semantic Versioning from here on.

## [0.0.5] - 2026-04-29

Extra usage shown with currency amounts. Earlier 0.0.x releases are listed on the
[releases page](https://github.com/DamMarin/claude-code-bar/releases).

[1.1.0]: https://github.com/DamMarin/claude-code-bar/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/DamMarin/claude-code-bar/compare/v0.0.5...v1.0.0
[0.0.5]: https://github.com/DamMarin/claude-code-bar/releases/tag/v0.0.5
