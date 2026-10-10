# Claude Mods

Small Claude Code mods (function-hook plugins) that stay out of the way.

| Mod | What it shows |
| --- | --- |
| `context-meter` | `Ctx  ████████░░░░░░░░░░░░ 42% · 84k of 200k tokens`; one toast when context passes 80%. |
| `usage-meter` | One row under `Ctx`: a pace bar per window, e.g. `Usg  5h ┃░░░░░░░░░░░ 1%→20% ↻4h55m  Wk █████████┃░░ 53%→66% ↻1d9h  Fable 100% ↻1d9h`. |

### Where they show

- **Desktop Code tab and terminal:** a band directly above the prompt box, `Ctx` on top and `Usg` under it, from the first reply of a session on (the figures arrive with each reply). Collapse it with its `[-]`.
- **Terminal and mobile:** a status line under the prompt, e.g. `🟢 5h 30% → 60%  🟡 Week 40% → 88%`.
- **Anywhere:** type `/usage-meter` or `/context-meter` for a text readout.

### Reading the usage bar

In the desktop app the figures come from the app's own usage card (5-hour, weekly, and each model's weekly limit), re-read every few minutes; elsewhere from the session's rate-limit readings. A model's weekly limit joins the row only once it leaves green. The `Usg` label takes the color of the worst window.

The fill is how much of the limit you have used; the `┃` mark is how far through the window you are. Fill that stays left of the mark is under pace.
`used→projected` is your use now and at reset if you keep the pace so far; `↻` is the time to reset.

| Color | Meaning |
| --- | --- |
| 🟢 green | Projected under 85% at reset: tracking at or below proportional use. |
| 🟡 yellow | Projected 85–100% at reset: near proportional use. |
| 🟠 orange | Projected past 100%: on pace to hit the limit before the window resets. |
| 🔴 red | 95% or more of the limit used, blocked included. |

Context colors: green under 60%, yellow 60–80%, orange 80–95%, red 95%+.
Thresholds are the constants at the top of `hooks/pace.ts` and `hooks/fill.ts`.

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

Each mod is `hooks/register.tsx`, loaded via `hooks/hooks.json`. Run one from its folder with
`claude --plugin-dir claude-mods/<mod>`, check it with `claude plugin validate claude-mods/<mod>`, and run its tests with `claude plugin test claude-mods/<mod>`.
