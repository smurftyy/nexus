# SETUP

## Prerequisites

| Tool | Minimum |
|---|---|
| Node.js | 20.0.0 |
| pnpm | 9.0.0 |
| TouchDesigner | 2023.11 (any edition) |
| OS | macOS 12+ or Windows 10+ |

## Clone and install

```bash
git clone <repo-url> nexus
cd nexus
pnpm install
```

## Environment setup

```bash
cp .env.example .env
```

Open `.env` and fill in each variable:

| Variable | What it is | How to get it |
|---|---|---|
| `TD_WS_PORT` | Port the WebSocket DAT listens on inside your `.tox`. Default `9980`. | Match to the "Network Port" field of your WebSocket DAT in TouchDesigner. |
| `TD_EXECUTABLE_PATH` | Absolute path to the TouchDesigner executable. Optional. | On macOS: `/Applications/TouchDesigner.app/Contents/MacOS/TouchDesigner`. On Windows: `C:\Program Files\Derivative\TouchDesigner\bin\TouchDesigner.exe`. Leave blank to launch TD manually. |
| `OUTPUT_DIR` | Absolute directory where exported `.mp4` clips are saved. | Any writable directory, e.g. `/Users/you/Desktop/nexus-exports`. Leave blank to use `~/Documents/Nexus/exports`. |
| `APP_ENV` | Runtime mode. | `development` for local work. `production` for packaged builds. |

## Run in development

Terminal 1 — compile shared and start Vite + tsc watchers:

```bash
pnpm dev
```

Wait until you see both:
- `VITE v5.x ready on http://localhost:5173`
- `tsc --watch` emitting `backend/dist/app/main.js`

Terminal 2 — launch Electron:

```bash
pnpm --filter backend start
```

**Expected:** Electron window opens showing the Nexus UI with a Connect button.

**First error if TD is not running:** The UI will show "disconnected" and an error after ~30 s. The backend retries the WebSocket connection 10 times with exponential backoff (500 ms to 30 s) before giving up.

## Project structure

```
nexus/
├── shared/src/              # Contract layer — touch with care
│   ├── types/ipc.ts         # IPC channel names, Zod schemas, NexusAPI interface
│   ├── types/template.ts    # Template and parameter types
│   ├── types/control.ts     # Control event types
│   └── protocol/websocket.ts# WebSocket message shapes (TD ↔ backend)
├── backend/src/
│   ├── app/main.ts          # Electron main entry, BrowserWindow creation
│   ├── app/preload.ts       # contextBridge — exposes window.nexusAPI to renderer
│   ├── core/engine/         # TDEngine: WebSocket client, reconnect, message emit
│   ├── core/config/         # Config loader (reads .env)
│   ├── ipc/                 # IPC handlers — one handler per channel
│   └── capture/             # CaptureManager — video export logic
├── frontend/src/
│   ├── App.tsx              # Root component and layout
│   ├── components/          # ControlPanel, TemplateSelector, ExportButton, LiveCanvas
│   ├── store/               # Zustand stores (connection state, template state)
│   └── hooks/               # useHandTracking (MediaPipe integration)
└── td/
    ├── config.json          # wsPort + template parameter definitions
    ├── scripts/param_bind.py# Paste into DAT Execute inside TouchDesigner
    └── templates/           # Setup notes per template (e.g. rasengan_notes.md)
```

## Ownership boundaries

**Backend dev owns:**
- Everything in `backend/src/`
- Electron main process, preload, IPC handlers, TDEngine, CaptureManager
- Changes to `shared/` (frontend dev must review)

**Frontend dev owns:**
- Everything in `frontend/src/`
- React components, Zustand stores, MediaPipe hook
- Changes to `shared/` (backend dev must review)

`shared/` is the contract between both processes. No IPC channel may be added without updating `shared/src/types/ipc.ts` first and getting review from both sides. See CONTRIBUTING.md for the 6-step IPC workflow.

## Before you push

```
pnpm typecheck   # must exit 0
pnpm test        # 11/11 tests must pass
```

- No `nodeIntegration: true` anywhere — all Node access goes through preload + contextBridge
- No hardcoded ports — all config values come from `backend/src/core/config/config.ts`
- IPC channels follow the 6-step workflow in CONTRIBUTING.md
- Any PR touching `shared/` needs approval from both backend and frontend owners

## Common issues

**Blank Electron window / DevTools shows `ERR_CONNECTION_REFUSED` on localhost:5173**
Electron loaded before Vite finished starting. Kill Electron, wait for the Vite "ready" line in Terminal 1, then re-run `pnpm --filter backend start`.

**Hand tracking never activates / no MediaPipe errors shown**
MediaPipe loads WASM from `cdn.jsdelivr.net` at runtime. On no-internet or corporate proxies this silently fails. Open DevTools → Network, filter by `mediapipe` — you will see failed fetches. Use a hotspot or whitelist the CDN.

**`workspace:*` dependency errors when using npm or yarn**
This repo uses pnpm workspaces. The `workspace:*` protocol is pnpm-only. Run `pnpm install`, not `npm install`.

**`Cannot find module 'nexus-shared'` at runtime**
`shared/` must be compiled before backend or frontend can import it. Run `pnpm --filter shared build` once after cloning, or use `pnpm dev` from root (it builds shared first automatically).

**TD connection never succeeds even with TD open**
Check that the WebSocket DAT in your `.tox` is set to **Server** mode and its Network Port matches `TD_WS_PORT` in your `.env`. The DAT must also have **Active** set to **On**. Paste `td/scripts/param_bind.py` into a DAT Execute connected to the WebSocket DAT.
