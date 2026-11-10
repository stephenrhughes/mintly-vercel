# Mintly EISCD API — Agent Skill

An agent skill that gives your AI coding assistant in-context knowledge of the Mintly EISCD API, so it can generate integration code for downloading and processing Extended Industry Sort Code Directory data. It covers both the weekly and monthly plans, and both v1 and v2 of the API.

Built on the [Agent Skills open standard](https://agentskills.io), this skill works across a wide range of AI coding tools.

## What it does

Once installed, invoke `/eiscd-api` in your AI assistant to:

- Download the full EISCD dataset in text, CSV, XML, or Excel format, on either plan
- Fetch and process weekly delta files to keep your data in sync (weekly plan)
- Refresh a full snapshot on a monthly cycle (monthly plan)
- Write a type-safe TypeScript client (fetch, no extra dependencies)
- Handle errors correctly for the version you are on — v2 status codes and JSON bodies, or v1's 200-with-XML edge case
- Migrate an existing integration from v1 to v2
- Schedule automated updates

## Requirements

Any [Agent Skills-compatible client](https://agentskills.io/clients), such as:

- [Claude Code](https://claude.ai/code)
- [VS Code](https://code.visualstudio.com) with GitHub Copilot (agent mode)
- [OpenAI Codex](https://openai.com/codex)
- [Cursor](https://cursor.com)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [GitHub Copilot](https://github.com/features/copilot) (CLI / VS Code)

## Installation

1. **Download and unzip** `eiscd-api-skill.zip` — you'll get an `eiscd-api/` folder containing `SKILL.md` and this `README.md`.

2. **Copy the `eiscd-api/` folder** to the skills directory for your tool. Use the **personal path** to make the skill available across all your projects; use the **project path** to share it with your team via version control.

   | Client | Personal path | Project path |
   |---|---|---|
   | Claude Code | `~/.claude/skills/eiscd-api/` | `.claude/skills/eiscd-api/` |
   | VS Code · Copilot · Cursor · Gemini CLI | `~/.agents/skills/eiscd-api/` | `.agents/skills/eiscd-api/` |
   | OpenAI Codex | `~/.codex/skills/eiscd-api/` | `.codex/skills/eiscd-api/` |

   **Example — personal install for Claude Code:**
   ```bash
   mkdir -p ~/.claude/skills
   cp -r eiscd-api ~/.claude/skills/eiscd-api
   ```

   **Example — personal install for VS Code / Copilot / Cursor / Gemini CLI:**
   ```bash
   mkdir -p ~/.agents/skills
   cp -r eiscd-api ~/.agents/skills/eiscd-api
   ```

3. **Set your API key** in an environment variable (never hardcode it). Keys are issued per
   plan, so use the one for the plan you are on:

   ```bash
   # .env.local — add this file to .gitignore
   MINTLY_EISCD_API_KEY=your_weekly_key_here           # weekly plan
   MINTLY_EISCD_MONTHLY_API_KEY=your_monthly_key_here  # monthly plan
   ```

4. **Invoke the skill** in your AI assistant:

   ```
   /eiscd-api
   ```

## Data refresh schedule

**Weekly plan:** new EISCD files are published every **Friday from 12:00 GMT**, valid from the following Monday.

**Monthly plan:** the source data is refreshed weekly, but the plan's quota is intended for one download per calendar month.

## API reference

Pick the reference for your plan and version — [https://www.mintly.uk/eiscd-docs](https://www.mintly.uk/eiscd-docs) has a picker for all three:

| Plan | Version | Base URL | OpenAPI specification |
|---|---|---|---|
| Weekly | v2 (current) | `https://api.mintly.uk/eiscd/v2` | https://www.mintly.uk/assets/eiscd-openapi-weekly-v2.yaml |
| Weekly | v1 (legacy) | `https://api.mintly.uk/eiscd` | https://www.mintly.uk/assets/eiscd-openapi.yaml |
| Monthly | v2 | `https://api.mintly.uk/eiscd-base/v2` | https://www.mintly.uk/assets/eiscd-openapi-monthly-v2.yaml |

## Support

Email: support@mintly.uk  
Terms: https://www.mintly.uk/terms
