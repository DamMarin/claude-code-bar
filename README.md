# claude-code-bar

[![npm](https://img.shields.io/npm/v/claude-code-bar)](https://www.npmjs.com/package/claude-code-bar) [![CI](https://img.shields.io/github/actions/workflow/status/DamMarin/claude-code-bar/ci.yml?branch=main&label=CI)](https://github.com/DamMarin/claude-code-bar/actions/workflows/ci.yml) [![node](https://img.shields.io/node/v/claude-code-bar)](https://nodejs.org/) [![dependencies](https://img.shields.io/badge/dependencies-0-2ea44f)](https://www.npmjs.com/package/claude-code-bar?activeTab=dependencies) [![license](https://img.shields.io/npm/l/claude-code-bar)](LICENSE) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/DamMarin/claude-code-bar/badge)](https://scorecard.dev/viewer/?uri=github.com/DamMarin/claude-code-bar) [![npm provenance](https://img.shields.io/badge/npm-provenance-2ea44f?logo=npm)](https://www.npmjs.com/package/claude-code-bar#provenance)

Never lose track of Claude Code context usage, rate limits, and git state - all in your terminal.

> No dependencies. No config needed. Just drop it in.


```text
🤖 Sonnet 4.6 │ 🧠 30% │ ⏱️ 2m14s │ my-project │ main*
⏱️ 5h  ▓▓▓▓▓░░░░░ 48%  resets 14:30
📅 7d  ▓▓░░░░░░░░ 21%  resets Thu
📜 S   ▓░░░░░░░░░ 5%  resets Sun
💰 Extra  ▓▓░░░░░░░░ 18%  €15.60 / €85
```

---

## ⚡ Quick start

```bash
npm install -g claude-code-bar
claude-code-bar --install
```

Restart Claude Code — you're done.

Want a different look? Run `claude-code-bar --config` to pick a theme, the segments and the layout in an interactive menu.

If you already had a `statusLine` from another tool, `--install` saves a copy of it and `--uninstall` puts it back.

---

## 🧠 Why use this?

Claude Code doesn’t show everything you need in one place.

`claude-code-bar` gives you instant visibility into:

* **Context usage** → avoid hitting limits mid-task
* **Rate limits** → no more guessing or checking dashboards
* **Extra usage spend** → see how much of your overage budget you’ve burned, in real money
* **Git state** → always know your branch, dirty status and unpushed commits
* **Session duration** → track how long you've been working
* **Model** → see exactly what you're running

All in one clean status bar.

---

## 🧩 What you get

* Context window usage (color-coded; `–` until Claude Code reports it, early in a session)
* 5-hour & 7-day rate limits
* Sonnet-specific usage tracking
* Extra usage spend (e.g. `€15.60 / €85`) with currency from your account
* Git branch, dirty indicator and commits ahead of / behind the upstream (`main* ⇡2⇣1`)
* Context in tokens if you prefer (`46k/200k`)
* Session cost and lines changed, if you turn them on (`$0.42`, `+156 −23`)
* Session duration
* Model name
* Themes, bar styles and a one-line layout — pick them in an interactive menu

---

## 🎨 Customize

```bash
claude-code-bar --config
```

An interactive menu in your terminal, with a live preview. Choose which segments to show and in what order, a theme (Default, Colorblind, Ocean, High contrast, Mono, None or your own colors), the bar style and width, and a multi-line or one-line layout.

| Key | Action |
| --- | --- |
| `↑` `↓` | Move between settings |
| `tab` or `1`–`4` | Switch between Segments, Theme, Bar and Layout |
| `space` | Show or hide a segment, use a theme |
| `←` `→` | Change a value |
| `m` | Move a segment, then `↑` `↓` and `enter` to drop it |
| `r` / `R` | Reset one setting / all settings |
| `enter` | Save to `~/.claude/settings.json` |
| `esc` | Quit (asks first if you have unsaved changes) |

The preview underlines whatever the focused setting changes, and moving over a theme previews it before you choose it. Restart Claude Code after saving.

For example, `--layout=compact` puts everything on one line:

```text
🤖 Sonnet 4.6 │ 🧠 30% │ ⏱️ 2m14s │ my-project │ main* │ 5h 48%  7d 21%  S 5%  💰 €15.60/€85
```

Your choices are stored as flags in the `statusLine` command, so you can also set them by hand:

```json
"command": "claude-code-bar --theme=ocean --hide=dir --bar=braille --reset=countdown"
```

| Option | What it does |
| --- | --- |
| `--theme=<name>` | `default`, `colorblind`, `ocean`, `high-contrast`, `mono`, `none` |
| `--colors=<role:color,…>` | Your own colors for `low`, `medium`, `high` and `accent`, from the 16 terminal colors |
| `--thresholds=<m>,<h>` | Where colors switch to medium and high (default `50,80`) |
| `--hide=<names>` | Hide `model`, `context`, `duration`, `dir`, `git`, `update`, `5h`, `7d`, `sonnet`, `extra` |
| `--add=<names>` | Show segments that are off by default: `cost` (estimated session cost at API list prices, not what a subscription bills) and `lines` (lines added and removed) |
| `--context=<view>` | `percent` (default), `tokens` (`46k/200k`) or `both` |
| `--order=<names>` | Order of the first line, e.g. `git,model,context` |
| `--layout=compact` | Everything on one line, without bars |
| `--bar=<style>` | `shade` ▓░, `block` █░, `line` ━─, `dots` ●○, `squares` ■□, `braille` ⣿⣀ |
| `--bar-width=<n>` | Bar width in characters (default `10`) |
| `--separator=<name>` | `pipe` │, `dot` ·, `slash` /, `arrow` › |
| `--show=left` | Show what is left instead of what is used |
| `--reset=countdown` | `in 2h10m` instead of `resets 14:30` |
| `--no-emoji` | Text labels instead of emoji |
| `--no-color` | No colors. `NO_COLOR` is respected too |

Options also work with `--install`, e.g. `claude-code-bar --install --theme=ocean`. Running `--install` again without options keeps the ones you have. See all options with `claude-code-bar --help`.

---

## ⚙️ How it works

Claude Code runs `claude-code-bar` as a command and sends data via stdin.

The tool:

1. Parses Claude’s runtime state
2. Enriches missing data (rate limits, git)
3. Renders the status bar with your display options

### Network and credentials

* **Rate limits.** Claude Code sends the 5-hour and 7-day windows on stdin. The Sonnet and extra usage windows, and any window Claude Code leaves out, are fetched from `api.anthropic.com/api/oauth/usage` with your Claude Code login token; nothing is fetched while every window you show is already known. It reads the token from `CLAUDE_CODE_OAUTH_TOKEN`, the macOS Keychain, `~/.claude/.credentials.json` or the Linux secret store, and sends it nowhere else. Results are cached for a minute, and dropped as soon as you log in with another account. Failures are cached too, so it never retries on every refresh: a minute normally, longer when the API says it is rate limited, an hour if the endpoint is not found. This endpoint is not a public, documented API, so it may change or go away without notice; the rate limit rows then simply don't appear. Hide every rate limit (`--hide=5h,7d,sonnet,extra`) and the token is never read.
* **Updates.** Once a day it asks `registry.npmjs.org` for the latest version, in the background. Hide the update notice (`--hide=update`) to turn this off.

---

## 🛠 Manual setup

If you prefer manual configuration:

```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-code-bar",
    "padding": 0,
    "refreshInterval": 60
  }
}
```

File: `~/.claude/settings.json`

`refreshInterval` re-runs the bar every minute while the session is idle, so reset countdowns and the limits stay current; leave it out if you only want updates when something happens in the session. `--install` and `--config` keep `padding`, `refreshInterval` and anything else you set here, and change only `command`.

Add [display options](#-customize) to `command`, e.g. `"claude-code-bar --theme=ocean --no-emoji"`.

The command can also run claude-code-bar through a package runner (`npx claude-code-bar@latest`, `pnpm dlx`, `yarn dlx`, `bunx`), but a global install is faster: Claude Code runs the command on every refresh, and npx, pnpm and yarn resolve the package each time (about 0.2 s, and 0.6 s or more with `@latest`, which also asks the npm registry, against 0.03 s installed). `--install` and `--config` warn when the command uses one of them. It can also run from a quoted path with spaces (`"/Users/John Doe/bin/claude-code-bar"`), or with shell syntax after the options (`2>/dev/null`). `--install`, `--config` and `--uninstall` recognize all of these and change only the options.

---

## 🔄 Update

```bash
npm update -g claude-code-bar
```

Check your current version:

```bash
claude-code-bar --version
```

---

## ❌ Uninstall

```bash
claude-code-bar --uninstall
npm uninstall -g claude-code-bar
```

`--uninstall` removes only claude-code-bar's `statusLine`, never another tool's, and restores the one `--install` replaced.

---

## 🧪 Requirements

* Node.js 22+ (since 1.1.0; 1.0.0 ran on Node 18)
* Claude Code CLI

---

## 🧯 Troubleshooting

### Command not found

Ensure your global npm bin directory is in your PATH.

### Nothing shows in Claude Code

* Restart Claude Code
* Verify `~/.claude/settings.json` contains the `statusLine` command

### An option has no effect

The status bar skips options it doesn't understand, so a typo never blanks it. To find the typo, run the command from `settings.json` by hand in a terminal:

```bash
claude-code-bar --theme=ocen --hide=dir
# --theme: unknown value "ocen". Use: default, colorblind, ocean, high-contrast, mono, none
```

### `--config` says it needs an interactive terminal

Run it directly in Terminal, iTerm or a similar app, not through a pipe or a script. To set options without the menu, use `claude-code-bar --install` with options.

---

## 🔒 Safety

* Zero dependencies
* Never crashes or prints errors to stdout
* Input is validated and bounded
* Folder, branch and model names are stripped of escape codes, so they can't control your terminal
* 5-second hard timeout
* A mistyped option is skipped, never breaks the bar
* `NO_COLOR` is respected
* Published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements): npm shows which commit and workflow built each version

### What it accesses

Package scanners such as [Socket](https://socket.dev/npm/package/claude-code-bar) flag environment variable, filesystem, process and network access. This is all of it, so you can check each alert against the code:

| Kind | What | Why |
| --- | --- | --- |
| Environment variables | `CLAUDE_CODE_OAUTH_TOKEN` | The login token for the usage API, when set (see [Network and credentials](#network-and-credentials)) |
| | `NO_COLOR` | Turns colors off |
| | `PATH`, `PATHEXT` | `--install` checks that the statusLine program can be found |
| Files it reads | `~/.claude/settings.json` | The statusLine to install or change, and the default model when Claude Code sends none |
| | `~/.claude/.credentials.json` | The login token, when it is not in the keychain |
| | Modification times of `~/.claude/.credentials.json`, `~/Library/Keychains/login.keychain-db` and `~/.local/share/keyrings/login.keyring` | Only the time, never the contents: a change means a new login, so the cached usage is dropped |
| Files it writes | `~/.claude/settings.json` | Only with `--install`, `--config` or `--uninstall`, and only the `statusLine` |
| | `~/.claude/claude-code-bar.statusline-backup.json` | The statusLine it replaced, restored by `--uninstall` |
| | `~/.cache/claude-code-bar/` | Caches: usage (a minute), git per folder (5 seconds), the latest version (a day). The token itself is never stored, only a short hash of `CLAUDE_CODE_OAUTH_TOKEN` to notice a change of login |
| Programs it runs | `git` | Branch, changes and commits ahead/behind, in the folder Claude Code runs in |
| | `security` (macOS), `secret-tool` (Linux) | Reads the Claude Code login token from the keychain |
| | `node` | The once-a-day update check, in the background, so it never slows the bar |
| Network | `api.anthropic.com` | The usage API, with your login token |
| | `registry.npmjs.org` | The latest version number, without anything about you |

Hide every rate limit (`--hide=5h,7d,sonnet,extra`) and no token is read and nothing is sent to Anthropic. Hide `update` and the bar never asks the npm registry (`--version` still does, when you run it). Hide `git` and `git` never runs.

---

## 📦 Versioning

This project follows [Semantic Versioning](https://semver.org/), starting with 1.0.0. Earlier releases (0.0.x) followed [ZeroVer](https://0ver.org/).

* **Major** (2.0.0): breaking changes, such as a removed or renamed option
* **Minor** (1.1.0): new features, such as a new option or theme
* **Patch** (1.0.1): bug fixes

The public API is the set of commands (`--install`, `--uninstall`, `--config`, `--version`, `--help`) and display options. Removing or changing the meaning of one of them is a major release.

---

## 🧑‍💻 Development

Bug reports, ideas and pull requests are welcome: see [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
npm test
npm run lint
```

Tests use the built-in `node --test` runner — still zero dependencies. CI runs them on Node 22, 24 and 26, on Linux and macOS.

Linting uses [oxlint](https://oxc.rs/docs/guide/usage/linter.html) with its `correctness` and `suspicious` rules (see `.oxlintrc.json`). It runs through `npx` at a pinned version, so it is not a dependency either: nothing is added to `package.json` and there is no lockfile. To upgrade it, change the version in the `lint` script.

### Releasing

First add the version's section to `CHANGELOG.md`: the release workflow publishes it as the GitHub release notes, and fails without it. Then:

```bash
npm version patch   # or minor / major; runs the linter and tests, bumps package.json, commits and tags vX.Y.Z
git push --follow-tags
```

The tag triggers the release workflow, which checks that the tag matches `package.json` and has a `CHANGELOG.md` section, lints, runs the tests, publishes to npm and creates the GitHub release with those notes.

A prerelease (`npm version prerelease --preid=beta`, giving e.g. `v1.1.0-beta.0`) is published under the `beta` dist-tag and marked as a prerelease on GitHub, so `npm install -g claude-code-bar` keeps installing the last release.

---

## 📄 License

MIT — see [LICENSE](./LICENSE)