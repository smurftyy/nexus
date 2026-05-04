# Nexus

A no-code generative visual effects desktop application. Nexus wraps TouchDesigner via WebSocket, letting you control real-time visual templates through a clean UI and export short video clips — no TD knowledge required.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20.0.0 |
| pnpm | ≥ 9.0.0 |
| TouchDesigner | 2023.11+ (any edition) |
| OS | macOS 12+ or Windows 10+ |

## Dev Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in your TD port (default 9980)
cp .env.example .env

# 3. In TouchDesigner, open (or create) your .tox and add a WebSocket DAT
#    set to Server mode, port matching TD_WS_PORT.

# 4. Start the dev servers (Vite + tsc watch)
pnpm dev

# 5. In a separate terminal, start Electron once the Vite server is up
pnpm --filter backend start
```

## Build

```bash
pnpm build          # compiles all packages
pnpm package        # packages to dist/ with electron-builder
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Electron App                     │
│                                                      │
│  ┌─────────────────────┐   ┌──────────────────────┐ │
│  │   Renderer Process   │   │    Main Process       │ │
│  │   (frontend/)        │   │    (backend/)         │ │
│  │                      │   │                       │ │
│  │  React + Zustand     │   │  TDEngine             │ │
│  │  ControlPanel        │◄──┤  IPC Handlers         │ │
│  │  TemplateSelector    │   │  CaptureManager       │ │
│  │  ExportButton        │   │  config               │ │
│  │                      │   │                       │ │
│  └──────────┬───────────┘   └──────────┬────────────┘ │
│             │   contextBridge           │              │
│             │   (preload.ts)            │              │
│             └───────────────────────────┘              │
└──────────────────────────────┬──────────────────────┘
                               │ WebSocket (localhost:TD_WS_PORT)
                    ┌──────────▼──────────┐
                    │   TouchDesigner      │
                    │   WebSocket DAT      │
                    │   (your .tox file)   │
                    └─────────────────────┘

Contract layer: shared/
  - All IPC channel names live in shared/src/types/ipc.ts
  - WebSocket message shapes live in shared/src/protocol/websocket.ts
  - No IPC channel may be added without updating shared/ first
```

## Package Ownership

| Directory | Owner | Purpose |
|---|---|---|
| `shared/` | Both devs (review required) | Types, schemas, protocol |
| `backend/` | Backend dev | Electron main, TD bridge |
| `frontend/` | Frontend dev | React UI |
