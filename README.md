# claude-code-bar

Never lose track of Claude Code context usage, rate limits, and git state - all in your terminal.

> No dependencies. No config. Just drop it in.


```text
🤖 Sonnet 4.6 │ 🧠 30% │ ⏱️ 2m14s │ my-project │ main*
⏱️ 5h  ▓▓▓▓▓░░░░░ 48%  resets 14:30
📅 7d  ▓▓░░░░░░░░ 21%  resets Thu
📜 S   ▓░░░░░░░░░ 5%   resets Sun
```

---

## ⚡ Quick start

```bash
npm install -g claude-code-bar
claude-code-bar --install
```

Restart Claude Code — you're done.

---

## 🧠 Why use this?

Claude Code doesn’t show everything you need in one place.

`claude-code-bar` gives you instant visibility into:

* **Context usage** → avoid hitting limits mid-task
* **Rate limits** → no more guessing or checking dashboards
* **Git state** → always know your branch and dirty status
* **Session duration** → track how long you've been working
* **Model** → see exactly what you're running

All in one clean status bar.

---

## 🧩 What you get

* Context window usage (color-coded)
* 5-hour & 7-day rate limits
* Sonnet-specific usage tracking
* Git branch and dirty indicator
* Session duration
* Model name

---

## ⚙️ How it works

Claude Code runs `claude-code-bar` as a command and sends data via stdin.

The tool:

1. Parses Claude’s runtime state
2. Enriches missing data (rate limits, git)
3. Renders a compact status bar

If rate limit data is missing, it fetches it using your Claude Code OAuth token (cached briefly).
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

---

## 🔒 Safety

* Zero dependencies
* Never crashes or prints errors to stdout
* Input is validated and bounded
* 5-second hard timeout

---

## 📦 Versioning

This project follows [ZeroVer](https://0ver.org/) (0-based versioning).

---

## 📄 License

MIT — see [LICENSE](./LICENSE)