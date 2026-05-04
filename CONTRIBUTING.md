# Contributing to Nexus

## Directory Ownership

| Directory | Primary Owner | Notes |
|---|---|---|
| `shared/` | **Both** | Changes require review from both owners |
| `backend/` | Backend | Electron main process, Node.js |
| `frontend/` | Frontend | React renderer, no Node APIs |
| `docs/` | Both | Plans, specs, ADRs |

## The shared/ Rule

`shared/` is the contract between frontend and backend. **Both developers must review any PR that touches `shared/`.** A change to `shared/src/types/ipc.ts` affects both processes — coordinate before merging.

## IPC Channel Rule

**No IPC channel may be implemented in `backend/src/ipc/handlers.ts` or called from `frontend/` without first adding it to `shared/src/types/ipc.ts`.**

The workflow is:
1. Add channel name to `IPC_CHANNELS` in `shared/src/types/ipc.ts`
2. Add request/response zod schemas to `shared/src/types/ipc.ts`
3. Add the channel to the `NexusAPI` interface
4. Implement `ipcMain.handle(...)` in `backend/src/ipc/handlers.ts`
5. Expose via `contextBridge` in `backend/src/app/preload.ts`
6. Call from frontend via `window.nexusAPI`

## Branch Naming

```
feat/<short-description>       # new capability
fix/<short-description>        # bug fix
chore/<short-description>      # tooling, deps, config
docs/<short-description>       # documentation only
```

## Process Rules

- **No `nodeIntegration: true`** ever. All Node access goes through the preload + contextBridge.
- **No hardcoded ports.** All config values read from `backend/src/core/config/config.ts`.
- **No `renderer/` directory in `backend/`.** Use `capture/` for output/recording logic.
- **Zod-validate all IPC payloads** in `handlers.ts` before using them. Treat renderer input as untrusted.
- Typecheck must pass before merging: `pnpm typecheck`.
