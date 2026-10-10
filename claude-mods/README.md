# Claude Mods

Small Claude Code mods (function-hook plugins) that stay out of the way.

| Mod | What it shows |
| --- | --- |
| `context-meter` | A status line such as `ctx 42% · 84k/200k`; one toast when context passes 80%. |
| `usage-meter` | A status line such as `usage 5h 23% ↻2h14m · 7d 41% ↻3d5h · $1.87`; one toast when a limit window passes 90%. |

## Install

At a Claude Code prompt:

```
/plugin install context-meter --marketplace aaronmsoto/agentic-extensions
/plugin install usage-meter --marketplace aaronmsoto/agentic-extensions
```

Answer `y` to add the marketplace, then pick the **user** scope so they load in every session.

## Cloud sessions (claude.ai/code, iOS)

Cloud sessions don't see your machine's settings. To load the mods there, add this to
`.claude/settings.json` in each repository you open in a cloud session:

```json
{
  "extraKnownMarketplaces": {
    "agentic-extensions": { "source": { "source": "github", "repo": "aaronmsoto/agentic-extensions" } }
  },
  "enabledPlugins": {
    "context-meter@agentic-extensions": true,
    "usage-meter@agentic-extensions": true
  }
}
```

## Develop

Each mod is `hooks/register.ts`, loaded via `hooks/hooks.json`. Run one from its folder with
`claude --plugin-dir claude-mods/<mod>`, and check it with `claude plugin validate claude-mods/<mod>`.
