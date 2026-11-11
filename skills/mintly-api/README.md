# Mintly Bank Account Checker API — Agent Skill

An agent skill that gives your AI coding assistant in-context knowledge of the Mintly Bank Account Checker API, so it can generate integration code, handle errors, and guide sandbox testing for your project.

Built on the [Agent Skills open standard](https://agentskills.io), this skill works across a wide range of AI coding tools.

## What it does

Once installed, invoke `/mintly-api` in your AI assistant to:

- Validate UK sort codes, account numbers, IBANs, and SWIFT/BIC codes
- Write a type-safe TypeScript client (fetch, no extra dependencies)
- Handle API errors and rate limiting correctly
- Set up sandbox testing with the provided test values
- Keep API keys out of source control

## Requirements

Any [Agent Skills-compatible client](https://agentskills.io/clients), such as:

- [Claude Code](https://claude.ai/code)
- [VS Code](https://code.visualstudio.com) with GitHub Copilot (agent mode)
- [OpenAI Codex](https://openai.com/codex)
- [Cursor](https://cursor.com)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [GitHub Copilot](https://github.com/features/copilot) (CLI / VS Code)

## Installation

1. **Download and unzip** `mintly-api-skill.zip` — you'll get a `mintly-api/` folder containing `SKILL.md` and this `README.md`.

2. **Copy the `mintly-api/` folder** to the skills directory for your tool. Use the **personal path** to make the skill available across all your projects; use the **project path** to share it with your team via version control.

   | Client | Personal path | Project path |
   |---|---|---|
   | Claude Code | `~/.claude/skills/mintly-api/` | `.claude/skills/mintly-api/` |
   | VS Code · Copilot · Cursor · Gemini CLI | `~/.agents/skills/mintly-api/` | `.agents/skills/mintly-api/` |
   | OpenAI Codex | `~/.codex/skills/mintly-api/` | `.codex/skills/mintly-api/` |

   **Example — personal install for Claude Code:**
   ```bash
   mkdir -p ~/.claude/skills
   cp -r mintly-api ~/.claude/skills/mintly-api
   ```

   **Example — personal install for VS Code / Copilot / Cursor / Gemini CLI:**
   ```bash
   mkdir -p ~/.agents/skills
   cp -r mintly-api ~/.agents/skills/mintly-api
   ```

3. **Set your API key** in an environment variable (never hardcode it):

   ```bash
   # .env.local — add this file to .gitignore
   MINTLY_API_KEY=your_key_here
   MINTLY_BASE_URL=https://sandbox.mintly.uk/bankAccount/v1
   ```

4. **Invoke the skill** in your AI assistant:

   ```
   /mintly-api
   ```

## Sandbox test values

| Input | Value |
|---|---|
| Sort code | `424242` |
| Account number | `42424242` |
| BIC | `TEST4242XXX` |
| IBAN | `GB42SAND424242 42424242` |

## API reference

Full OpenAPI specification: https://www.mintly.uk/assets/swagger.yaml

## Support

Email: support@mintly.uk  
Terms: https://www.mintly.uk/terms/
