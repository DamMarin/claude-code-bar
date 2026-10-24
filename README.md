# claude-code-bar

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
* **Git state** → always know your branch and dirty status
* **Session duration** → track how long you've been working
* **Model** → see exactly what you're running

All in one clean status bar.

---

## 🧩 What you get

* Context window usage (color-coded)
* 5-hour & 7-day rate limits
* Sonnet-specific usage tracking
* Extra usage spend (e.g. `€15.60 / €85`) with currency from your account
* Git branch and dirty indicator
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

* **Rate limits.** When Claude Code doesn't send rate limit data, claude-code-bar fetches it from `api.anthropic.com/api/oauth/usage` with your Claude Code login token. It reads the token from `CLAUDE_CODE_OAUTH_TOKEN`, the macOS Keychain, `~/.claude/.credentials.json` or the Linux secret store, and sends it nowhere else. Results are cached for a minute. Failures are cached too, so it never retries on every refresh: a minute normally, longer when the API says it is rate limited. Hide every rate limit (`--hide=5h,7d,sonnet,extra`) and the token is never read.
* **Updates.** Once a day it asks `registry.npmjs.org` for the latest version, in the background. Hide the update notice (`--hide=update`) to turn this off.

---

## 🛠 Manual setup

If you prefer manual configuration:

```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-code-bar",
    "padding": 0
  }
}
```

File: `~/.claude/settings.json`

Add [display options](#-customize) to `command`, e.g. `"claude-code-bar --theme=ocean --no-emoji"`.

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

* Node.js 18+
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
* 5-second hard timeout
* A mistyped option is skipped, never breaks the bar
* `NO_COLOR` is respected

---

## 📦 Versioning

This project follows [Semantic Versioning](https://semver.org/), starting with 1.0.0. Earlier releases (0.0.x) followed [ZeroVer](https://0ver.org/).

* **Major** (2.0.0): breaking changes, such as a removed or renamed option
* **Minor** (1.1.0): new features, such as a new option or theme
* **Patch** (1.0.1): bug fixes

The public API is the set of commands (`--install`, `--uninstall`, `--config`, `--version`, `--help`) and display options. Removing or changing the meaning of one of them is a major release.

---

## 🧑‍💻 Development

```bash
npm test
```

Tests use the built-in `node --test` runner — still zero dependencies. CI runs them on Node 18, 20 and 22, on Linux and macOS.

### Releasing

```bash
npm version patch   # or minor / major; runs the tests, bumps package.json, commits and tags vX.Y.Z
git push --follow-tags
```

The tag triggers the release workflow, which checks that the tag matches `package.json`, runs the tests and publishes to npm.

---

## 📄 License

MIT — see [LICENSE](./LICENSE)