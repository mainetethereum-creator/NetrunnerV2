# Netrunner — CyberBase 3D

Browser 3D action / extraction game: Next.js + React UI, Three.js scenes, Base wallet via wagmi.

- `/` — hub (landing page)
- `/base` — Runner's Refuge
- `/expedition` — Outlands
- `/metro` — frozen metro prototype
- Development only (`npm run dev`): `/editor/vegetation`, `/ui-kit-preview`, MASTER map editor, debug panel

Start with `AGENTS.md`, then `PROJECT_STATE.md`, `ARCHITECTURE.md`, `CODEMAP.md`, `DECISIONS.md` and `AI_HANDOFF.md`.

```bash
npm ci
npm run dev        # http://localhost:3000
npm test
npm run build
```

- Repository: https://github.com/mainetethereum-creator/NetrunnerV2 (branch `main`)
- Live: https://netrunner-cyberbase.vercel.app (deployed automatically from `main`)
- Location: `D:\V2 Cyber\Netrunner`

The game is independent from the cyberbase.fun website, the whitelist and the legacy 2D city / metro code.
