<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Process hygiene (Claude and Codex)

This machine has repeatedly overheated (CPU ~80C, 500-600 running processes)
because agent sessions started dev servers, browsers, and MCP helper
processes (`uv.exe`, `python.exe`, `StudioMCP.exe`, browser automation) and
never stopped them. Follow these rules in every session working in this repo:

- Before starting a dev server or browser preview, check whether one is
  already running (`preview_list`, or an existing terminal/task) and reuse it
  instead of starting another.
- Stop every server, browser tab, and background task you started
  (`preview_stop`, closing browser tabs, `TaskStop`) before ending a task or
  handing off — even if the user did not ask for cleanup.
- Do not spawn subagents or extra tool processes unless the task genuinely
  needs them or the user asks for it.
- If the machine feels slow, run `powershell -File scripts/agent-processes.ps1`
  (dry run; add `-Stop` to terminate the known MCP-helper processes it
  reports — `uv.exe`, `python.exe`, `StudioMCP.exe`) to clear what has leaked.
