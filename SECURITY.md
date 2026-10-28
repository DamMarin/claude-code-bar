# Security policy

## Supported versions

Security fixes go into the latest release. Update with `npm update -g claude-code-bar`.

| Version | Supported |
| --- | --- |
| 1.x (latest) | ✅ |
| older | ❌ |

## Reporting a vulnerability

Please don't open a public issue. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/DamMarin/claude-code-bar/security/advisories/new)
(the **Report a vulnerability** button on the Security tab).

Include what you found, how to reproduce it, and which version and platform you used.
You'll get an answer within a week. A confirmed issue is fixed in a new release and
credited in its release notes, unless you prefer not to be named.

## Scope

claude-code-bar reads your Claude Code login token to show rate limits, so reports about
the token (how it is read, cached or sent) are especially welcome. The README's
[What it accesses](README.md#what-it-accesses) section lists every environment variable,
file, program and host it uses.
