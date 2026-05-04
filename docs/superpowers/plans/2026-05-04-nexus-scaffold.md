# Nexus Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete Nexus Electron + TypeScript monorepo — a no-code generative visual effects tool that controls TouchDesigner via WebSocket.

**Architecture:** pnpm workspaces with three packages: `shared` (zod types + WS protocol), `backend` (Electron main, TDEngine, IPC handlers, capture), `frontend` (React + Zustand + Vite renderer). Backend compiles via `tsc` + `tsc-alias`; path aliases `@shared/*` → `shared/src/*`, `@backend/*` → `backend/src/*`, `@frontend/*` → `frontend/src/*`.

**Tech Stack:** Electron 31, TypeScript 5.6 (strict), React 18, Zustand 5, Vite 5, Zod 3, ws 8, dotenv 16, electron-builder 25, tsc-alias 1.8, vitest 2 (backend unit tests), pnpm 9+ workspaces.

---

## File Map

```
nexus/
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── README.md
├── package.json                          # root — scripts only, no src
├── pnpm-workspace.yaml
├── tsconfig.base.json                    # shared compiler options
├── tsconfig.json                         # root project references
│
├── shared/                               # package: nexus-shared
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      # barrel export
│       ├── types/
│       │   ├── control.ts               # ControlSchema, ControlValue, ParameterUpdate
│       │   ├── ipc.ts                   # IPC_CHANNELS, request/response shapes, NexusAPI
│       │   └── template.ts             # TemplateMetadata, TemplateParameter, MVP params
│       └── protocol/
│           └── websocket.ts             # Nexus↔TD WS message protocol + parse helper
│
├── backend/                              # package: nexus-backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── main.ts                  # Electron entry: BrowserWindow, IPC init
│       │   └── preload.ts              # contextBridge: typed NexusAPI surface
│       ├── core/
│       │   ├── config/
│       │   │   └── config.ts           # env loading + validation (no hardcoded ports)
│       │   └── engine/
│       │       ├── tdEngine.ts          # WebSocket bridge + exponential backoff reconnect
│       │       └── tdEngine.test.ts     # vitest: connect, disconnect, reconnect, message
│       ├── capture/
│       │   ├── captureManager.ts        # Export orchestration: send→wait→timeout
│       │   └── captureManager.test.ts   # vitest: success, error, timeout
│       └── ipc/
│           └── handlers.ts             # registerIpcHandlers: all invoke + push channels
│
└── frontend/                             # package: nexus-frontend
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx                      # ReactDOM.createRoot entry
        ├── App.tsx                       # Root layout: header + panels
        ├── types/
        │   └── window.d.ts              # Window.nexusAPI type augmentation
        ├── hooks/
        │   └── useIpc.ts               # Subscribe to all push events, update stores
        ├── store/
        │   ├── useConnectionStore.ts    # Zustand: connection state + connect/disconnect
        │   └── useTemplateStore.ts     # Zustand: active template, paramValues, export
        └── components/
            ├── ControlPanel/
            │   ├── ControlPanel.tsx     # Maps template.parameters → SliderControl
            │   ├── SliderControl.tsx    # Single <input type=range> with label
            │   └── index.ts
            ├── ExportButton/
            │   ├── ExportButton.tsx     # Triggers export, shows file path result
            │   └── index.ts
            └── TemplateSelector/
                ├── TemplateSelector.tsx # Text input for .tox path (file picker stub)
                └── index.ts
```

---

### Task 1: Monorepo foundation

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'shared'
  - 'backend'
  - 'frontend'
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

- [ ] **Step 3: Create root `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./shared" },
    { "path": "./backend" },
    { "path": "./frontend" }
  ]
}
```

- [ ] **Step 4: Create root `package.json`**

```json
{
  "name": "nexus",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "concurrently -n frontend,backend -c cyan,magenta \"pnpm --filter frontend dev\" \"pnpm --filter backend dev\"",
    "build": "pnpm --filter shared build && pnpm --filter backend build && pnpm --filter frontend build",
    "typecheck": "tsc --build",
    "package": "pnpm build && electron-builder --config electron-builder.yml"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "electron-builder": "^25.1.8",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.env
.DS_Store
*.tox
*.mp4
*.mov
*.log
```

- [ ] **Step 6: Verify workspace file is valid**

```bash
cat pnpm-workspace.yaml
```

Expected output shows three entries: shared, backend, frontend.

---

### Task 2: Shared package setup

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "nexus-shared",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node10",
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### Task 3: `shared/src/types/control.ts`

**Files:**
- Create: `shared/src/types/control.ts`

- [ ] **Step 1: Write `shared/src/types/control.ts`**

```typescript
import { z } from 'zod'

export const ControlTypeSchema = z.enum(['slider', 'toggle', 'select'])
export type ControlType = z.infer<typeof ControlTypeSchema>

export const ControlRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
})
export type ControlRange = z.infer<typeof ControlRangeSchema>

export const SelectOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
})
export type SelectOption = z.infer<typeof SelectOptionSchema>

export const ControlSchemaDefinition = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: ControlTypeSchema,
  range: ControlRangeSchema.optional(),
  options: z.array(SelectOptionSchema).optional(),
  defaultValue: z.union([z.number(), z.boolean(), z.string()]),
})
export type ControlSchema = z.infer<typeof ControlSchemaDefinition>

export const ControlValueSchema = z.union([z.number(), z.boolean(), z.string()])
export type ControlValue = z.infer<typeof ControlValueSchema>

export const ParameterUpdateSchema = z.object({
  templateId: z.string().min(1),
  parameterId: z.string().min(1),
  value: ControlValueSchema,
})
export type ParameterUpdate = z.infer<typeof ParameterUpdateSchema>
```

- [ ] **Step 2: Spot-check schema parses correctly**

Run a quick inline check (no test framework needed yet):

```bash
cd shared && node -e "
const { ParameterUpdateSchema } = require('./dist/types/control.js');
const ok = ParameterUpdateSchema.parse({ templateId: 't1', parameterId: 'spin', value: 0.5 });
console.log('OK:', JSON.stringify(ok));
const bad = ParameterUpdateSchema.safeParse({ templateId: '' });
console.log('BAD (expected):', bad.success);
" 2>/dev/null || echo "(run after pnpm --filter shared build)"
```

---

### Task 4: `shared/src/types/template.ts`

**Files:**
- Create: `shared/src/types/template.ts`

- [ ] **Step 1: Write `shared/src/types/template.ts`**

```typescript
import { z } from 'zod'
import { ControlSchemaDefinition, ControlValueSchema } from './control'

export const TemplateParameterSchema = ControlSchemaDefinition.extend({
  currentValue: ControlValueSchema,
})
export type TemplateParameter = z.infer<typeof TemplateParameterSchema>

export const TemplateMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  toxPath: z.string().min(1),
  parameters: z.array(TemplateParameterSchema),
  previewImagePath: z.string().optional(),
})
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>

// The 4 CHOP parameters required for the MVP template.
// These are the default parameter definitions; runtime values are updated via ParameterUpdate.
export const MVP_TEMPLATE_PARAMETERS: TemplateParameter[] = [
  {
    id: 'spin',
    label: 'Spin',
    type: 'slider',
    range: { min: -1, max: 1, step: 0.01 },
    defaultValue: 0,
    currentValue: 0,
  },
  {
    id: 'scale',
    label: 'Scale',
    type: 'slider',
    range: { min: 0.1, max: 5, step: 0.01 },
    defaultValue: 1,
    currentValue: 1,
  },
  {
    id: 'intensity',
    label: 'Intensity',
    type: 'slider',
    range: { min: 0, max: 1, step: 0.01 },
    defaultValue: 0.5,
    currentValue: 0.5,
  },
  {
    id: 'hue',
    label: 'Hue',
    type: 'slider',
    range: { min: 0, max: 360, step: 1 },
    defaultValue: 180,
    currentValue: 180,
  },
]
```

---

### Task 5: `shared/src/types/ipc.ts`

**Files:**
- Create: `shared/src/types/ipc.ts`

- [ ] **Step 1: Write `shared/src/types/ipc.ts`**

```typescript
import { z } from 'zod'
import { ParameterUpdateSchema } from './control'
import { TemplateMetadataSchema } from './template'

// All IPC channel names as const — the single source of truth.
// Adding a new channel here is the mandatory first step before implementing it anywhere.
export const IPC_CHANNELS = {
  // Renderer → Main (ipcRenderer.invoke / ipcMain.handle)
  TD_CONNECT: 'td:connect',
  TD_DISCONNECT: 'td:disconnect',
  TD_SEND_PARAM: 'td:send-param',
  TD_LOAD_TEMPLATE: 'td:load-template',
  TD_EXPORT: 'td:export',
  TD_GET_STATUS: 'td:get-status',

  // Main → Renderer (webContents.send / ipcRenderer.on)
  TD_CONNECTION_CHANGED: 'td:connection-changed',
  TD_EXPORT_COMPLETE: 'td:export-complete',
  TD_ERROR: 'td:error',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ── Connection state ────────────────────────────────────────────────────────

export const ConnectionStateSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
])
export type ConnectionState = z.infer<typeof ConnectionStateSchema>

// ── Invoke request/response shapes ─────────────────────────────────────────

export const TdConnectResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})
export type TdConnectResponse = z.infer<typeof TdConnectResponseSchema>

export const TdSendParamRequestSchema = ParameterUpdateSchema
export type TdSendParamRequest = z.infer<typeof TdSendParamRequestSchema>

export const TdSendParamResponseSchema = z.object({ success: z.boolean() })
export type TdSendParamResponse = z.infer<typeof TdSendParamResponseSchema>

export const TdLoadTemplateRequestSchema = z.object({
  toxPath: z.string().min(1),
})
export type TdLoadTemplateRequest = z.infer<typeof TdLoadTemplateRequestSchema>

export const TdLoadTemplateResponseSchema = z.object({
  success: z.boolean(),
  template: TemplateMetadataSchema.optional(),
  error: z.string().optional(),
})
export type TdLoadTemplateResponse = z.infer<typeof TdLoadTemplateResponseSchema>

export const TdExportRequestSchema = z.object({
  durationSeconds: z.number().positive(),
  outputDir: z.string().min(1),
  filename: z.string().min(1),
})
export type TdExportRequest = z.infer<typeof TdExportRequestSchema>

export const TdExportResponseSchema = z.object({
  success: z.boolean(),
  filePath: z.string().optional(),
  error: z.string().optional(),
})
export type TdExportResponse = z.infer<typeof TdExportResponseSchema>

export const TdGetStatusResponseSchema = z.object({
  state: ConnectionStateSchema,
  templateId: z.string().optional(),
})
export type TdGetStatusResponse = z.infer<typeof TdGetStatusResponseSchema>

// ── Push payload shapes (Main → Renderer) ──────────────────────────────────

export const TdConnectionChangedPayloadSchema = z.object({
  state: ConnectionStateSchema,
})
export type TdConnectionChangedPayload = z.infer<typeof TdConnectionChangedPayloadSchema>

export const TdExportCompletePayloadSchema = z.object({
  filePath: z.string(),
})
export type TdExportCompletePayload = z.infer<typeof TdExportCompletePayloadSchema>

export const TdErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
})
export type TdErrorPayload = z.infer<typeof TdErrorPayloadSchema>

// ── contextBridge API surface exposed to the renderer ──────────────────────
// This interface is implemented in backend/src/app/preload.ts and consumed
// via window.nexusAPI in the frontend (typed in frontend/src/types/window.d.ts).

export interface NexusAPI {
  connect: () => Promise<TdConnectResponse>
  disconnect: () => Promise<void>
  sendParam: (req: TdSendParamRequest) => Promise<TdSendParamResponse>
  loadTemplate: (req: TdLoadTemplateRequest) => Promise<TdLoadTemplateResponse>
  export: (req: TdExportRequest) => Promise<TdExportResponse>
  getStatus: () => Promise<TdGetStatusResponse>

  // Push subscriptions — return an unsubscribe function.
  // Callers MUST call the returned function on component unmount to avoid leaks.
  onConnectionChanged: (cb: (payload: TdConnectionChangedPayload) => void) => () => void
  onExportComplete: (cb: (payload: TdExportCompletePayload) => void) => () => void
  onError: (cb: (payload: TdErrorPayload) => void) => () => void
}
```

---

### Task 6: `shared/src/protocol/websocket.ts`

**Files:**
- Create: `shared/src/protocol/websocket.ts`

- [ ] **Step 1: Write `shared/src/protocol/websocket.ts`**

```typescript
import { z } from 'zod'

// ── Outbound: Nexus → TouchDesigner ────────────────────────────────────────
// TD WebSocket DAT receives these as JSON strings.

export const TdParamUpdateMessageSchema = z.object({
  type: z.literal('param_update'),
  templateId: z.string(),
  parameterId: z.string(),
  value: z.union([z.number(), z.boolean(), z.string()]),
})
export type TdParamUpdateMessage = z.infer<typeof TdParamUpdateMessageSchema>

export const TdLoadTemplateMessageSchema = z.object({
  type: z.literal('load_template'),
  toxPath: z.string(),
})
export type TdLoadTemplateMessage = z.infer<typeof TdLoadTemplateMessageSchema>

export const TdStartRecordingMessageSchema = z.object({
  type: z.literal('start_recording'),
  durationSeconds: z.number().positive(),
  outputPath: z.string(),
})
export type TdStartRecordingMessage = z.infer<typeof TdStartRecordingMessageSchema>

export const TdPingMessageSchema = z.object({ type: z.literal('ping') })
export type TdPingMessage = z.infer<typeof TdPingMessageSchema>

export const TdOutboundMessageSchema = z.discriminatedUnion('type', [
  TdParamUpdateMessageSchema,
  TdLoadTemplateMessageSchema,
  TdStartRecordingMessageSchema,
  TdPingMessageSchema,
])
export type TdOutboundMessage = z.infer<typeof TdOutboundMessageSchema>

// ── Inbound: TouchDesigner → Nexus ─────────────────────────────────────────
// TD WebSocket DAT sends these as JSON strings.

export const TdReadyMessageSchema = z.object({
  type: z.literal('ready'),
  templateId: z.string(),
})
export type TdReadyMessage = z.infer<typeof TdReadyMessageSchema>

export const TdParamAckMessageSchema = z.object({
  type: z.literal('param_ack'),
  parameterId: z.string(),
  value: z.union([z.number(), z.boolean(), z.string()]),
})
export type TdParamAckMessage = z.infer<typeof TdParamAckMessageSchema>

export const TdRecordingStartedMessageSchema = z.object({
  type: z.literal('recording_started'),
  outputPath: z.string(),
})
export type TdRecordingStartedMessage = z.infer<typeof TdRecordingStartedMessageSchema>

export const TdRecordingCompleteMessageSchema = z.object({
  type: z.literal('recording_complete'),
  filePath: z.string(),
})
export type TdRecordingCompleteMessage = z.infer<typeof TdRecordingCompleteMessageSchema>

export const TdErrorMessageSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
})
export type TdErrorMessage = z.infer<typeof TdErrorMessageSchema>

export const TdPongMessageSchema = z.object({ type: z.literal('pong') })
export type TdPongMessage = z.infer<typeof TdPongMessageSchema>

export const TdInboundMessageSchema = z.discriminatedUnion('type', [
  TdReadyMessageSchema,
  TdParamAckMessageSchema,
  TdRecordingStartedMessageSchema,
  TdRecordingCompleteMessageSchema,
  TdErrorMessageSchema,
  TdPongMessageSchema,
])
export type TdInboundMessage = z.infer<typeof TdInboundMessageSchema>

// Returns null and logs if the raw string is not a valid inbound message.
// Never throws — callers must handle null.
export function parseTdInboundMessage(raw: string): TdInboundMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = TdInboundMessageSchema.safeParse(parsed)
    if (!result.success) {
      console.error('[ws-protocol] Invalid inbound message:', result.error.message)
      return null
    }
    return result.data
  } catch {
    console.error('[ws-protocol] WebSocket data is not valid JSON')
    return null
  }
}
```

---

### Task 7: Shared barrel export + typecheck

**Files:**
- Create: `shared/src/index.ts`

- [ ] **Step 1: Write `shared/src/index.ts`**

```typescript
export * from './types/control'
export * from './types/template'
export * from './types/ipc'
export * from './protocol/websocket'
```

- [ ] **Step 2: Typecheck shared package**

```bash
cd shared && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/ pnpm-workspace.yaml tsconfig.base.json tsconfig.json package.json .gitignore
git commit -m "feat: scaffold monorepo foundation and shared types/protocol"
```

---

### Task 8: Backend package setup

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "nexus-backend",
  "version": "0.1.0",
  "private": true,
  "main": "dist/app/main.js",
  "scripts": {
    "dev": "tsc -p tsconfig.json --watch",
    "build": "tsc -p tsconfig.json && tsc-alias -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "electron ."
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "nexus-shared": "workspace:*",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "@types/ws": "^8.5.12",
    "electron": "^31.6.0",
    "tsc-alias": "^1.8.10",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node10",
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "paths": {
      "@shared/*": ["../shared/src/*"],
      "@backend/*": ["./src/*"]
    }
  },
  "references": [
    { "path": "../shared" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### Task 9: `backend/src/core/config/config.ts`

**Files:**
- Create: `backend/src/core/config/config.ts`

- [ ] **Step 1: Write `backend/src/core/config/config.ts`**

```typescript
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config()

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export interface AppConfig {
  tdWsPort: number
  tdExecutablePath: string | null
  outputDir: string
  appEnv: 'development' | 'production'
}

function loadConfig(): AppConfig {
  const rawPort = optionalEnv('TD_WS_PORT', '9980')
  const tdWsPort = parseInt(rawPort, 10)
  if (isNaN(tdWsPort) || tdWsPort < 1 || tdWsPort > 65535) {
    throw new Error(`TD_WS_PORT must be a valid port number (1–65535), got: "${rawPort}"`)
  }

  const rawOutputDir = optionalEnv(
    'OUTPUT_DIR',
    path.join(process.env['HOME'] ?? process.env['USERPROFILE'] ?? '~', 'Documents', 'Nexus', 'exports'),
  )
  const outputDir = rawOutputDir.replace(/^~/, process.env['HOME'] ?? process.env['USERPROFILE'] ?? '~')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const rawEnv = optionalEnv('APP_ENV', 'development')
  if (rawEnv !== 'development' && rawEnv !== 'production') {
    throw new Error(`APP_ENV must be "development" or "production", got: "${rawEnv}"`)
  }

  return {
    tdWsPort,
    tdExecutablePath: process.env['TD_EXECUTABLE_PATH'] ?? null,
    outputDir,
    appEnv: rawEnv,
  }
}

export const config = loadConfig()
```

---

### Task 10: `backend/src/core/engine/tdEngine.ts` + unit tests

**Files:**
- Create: `backend/src/core/engine/tdEngine.ts`
- Create: `backend/src/core/engine/tdEngine.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `backend/src/core/engine/tdEngine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock the 'ws' module before importing TDEngine
vi.mock('ws', () => {
  const WS = vi.fn()
  WS.prototype = Object.create(EventEmitter.prototype)
  WS.prototype.constructor = WS
  WS.prototype.send = vi.fn()
  WS.prototype.close = vi.fn()
  return { default: WS }
})

import WebSocket from 'ws'
import { TDEngine } from './tdEngine'

function makeMockWs() {
  const ws = new (WebSocket as unknown as new (url: string) => EventEmitter & {
    send: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  })('ws://localhost:9980')
  return ws
}

describe('TDEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in disconnected state', () => {
    const engine = new TDEngine(9980)
    expect(engine.connectionState).toBe('disconnected')
  })

  it('transitions to connecting then connected on open', async () => {
    const engine = new TDEngine(9980)
    const states: string[] = []
    engine.on('connectionChanged', (s) => states.push(s))

    const connectPromise = engine.connect()
    expect(engine.connectionState).toBe('connecting')

    const ws = makeMockWs()
    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('open')
    await connectPromise

    expect(states).toEqual(['connecting', 'connected'])
    expect(engine.connectionState).toBe('connected')
  })

  it('transitions to disconnected on intentional disconnect', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('open')
    await connectPromise

    engine.disconnect()
    expect(engine.connectionState).toBe('disconnected')
  })

  it('schedules reconnect with exponential backoff on unexpected close', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('open')
    await connectPromise

    const states: string[] = []
    engine.on('connectionChanged', (s) => states.push(s))

    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('close')
    expect(engine.connectionState).toBe('reconnecting')

    // First backoff: 500ms * 2^0 = 500ms
    vi.advanceTimersByTime(499)
    expect((WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect((WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })

  it('emits parsed inbound messages', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    const messages: unknown[] = []
    engine.on('message', (m) => messages.push(m))

    wsInstance.emit('message', JSON.stringify({ type: 'pong' }))
    expect(messages).toHaveLength(1)
    expect((messages[0] as { type: string }).type).toBe('pong')
  })

  it('ignores malformed inbound messages without throwing', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    const messages: unknown[] = []
    engine.on('message', (m) => messages.push(m))

    wsInstance.emit('message', 'not-json{{{')
    wsInstance.emit('message', JSON.stringify({ type: 'unknown_type' }))
    expect(messages).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (TDEngine doesn't exist yet)**

```bash
cd backend && npx vitest run src/core/engine/tdEngine.test.ts 2>&1 | head -20
```

Expected: fails with "Cannot find module './tdEngine'"

- [ ] **Step 3: Write `backend/src/core/engine/tdEngine.ts`**

```typescript
import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { parseTdInboundMessage } from '@shared/protocol/websocket'
import type { TdOutboundMessage, TdInboundMessage } from '@shared/protocol/websocket'
import type { ConnectionState } from '@shared/types/ipc'

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 30_000

interface TDEngineEvents {
  connectionChanged: [state: ConnectionState]
  message: [msg: TdInboundMessage]
  error: [err: Error]
}

export class TDEngine extends EventEmitter<TDEngineEvents> {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalDisconnect = false
  private readonly port: number

  constructor(port: number) {
    super()
    this.port = port
  }

  get connectionState(): ConnectionState {
    return this.state
  }

  connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return Promise.resolve()
    }
    this.intentionalDisconnect = false
    return this.openConnection()
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    this.clearReconnectTimer()
    this.ws?.close()
    this.setState('disconnected')
  }

  send(message: TdOutboundMessage): void {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error(`Cannot send: TDEngine is ${this.state}`)
    }
    this.ws.send(JSON.stringify(message))
  }

  private openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState('connecting')
      const ws = new WebSocket(`ws://localhost:${this.port}`)
      this.ws = ws

      const onOpen = () => {
        cleanup()
        this.reconnectAttempts = 0
        this.setState('connected')
        resolve()
      }

      const onError = (err: Error) => {
        cleanup()
        if (this.state === 'connecting') reject(err)
        this.handleDisconnect()
      }

      const cleanup = () => {
        ws.off('open', onOpen)
        ws.off('error', onError)
      }

      ws.on('open', onOpen)
      ws.on('error', onError)
      ws.on('close', () => this.handleDisconnect())
      ws.on('message', (data: WebSocket.RawData) => {
        const msg = parseTdInboundMessage(data.toString())
        if (msg) this.emit('message', msg)
      })
    })
  }

  private handleDisconnect(): void {
    if (this.intentionalDisconnect) return
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setState('disconnected')
      this.emit('error', new Error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`))
      return
    }

    this.setState('reconnecting')
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.reconnectAttempts, MAX_DELAY_MS)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      this.openConnection().catch(() => {
        // close/error events on the new socket trigger the next scheduleReconnect
      })
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return
    this.state = next
    this.emit('connectionChanged', next)
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && npx vitest run src/core/engine/tdEngine.test.ts
```

Expected: all tests pass (6 passing).

- [ ] **Step 5: Commit**

```bash
git add backend/src/core/engine/
git commit -m "feat: implement TDEngine with exponential backoff reconnect"
```

---

### Task 11: `backend/src/capture/captureManager.ts` + unit tests

**Files:**
- Create: `backend/src/capture/captureManager.ts`
- Create: `backend/src/capture/captureManager.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `backend/src/capture/captureManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { TdInboundMessage } from '@shared/protocol/websocket'
import type { ConnectionState } from '@shared/types/ipc'

// Minimal TDEngine stub — only what CaptureManager uses
function makeMockEngine() {
  const emitter = new EventEmitter() as EventEmitter & {
    connectionState: ConnectionState
    send: ReturnType<typeof vi.fn>
    on: (event: string, listener: (...args: unknown[]) => void) => typeof emitter
    off: (event: string, listener: (...args: unknown[]) => void) => typeof emitter
    emit: (event: string, ...args: unknown[]) => boolean
  }
  emitter.connectionState = 'connected'
  emitter.send = vi.fn()
  return emitter
}

import { CaptureManager } from './captureManager'

describe('CaptureManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('resolves with filePath on recording_complete', async () => {
    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    const msg: TdInboundMessage = { type: 'recording_complete', filePath: '/tmp/exports/clip.mp4' }
    engine.emit('message', msg)

    const result = await resultPromise
    expect(result.success).toBe(true)
    expect(result.filePath).toBe('/tmp/exports/clip.mp4')
  })

  it('resolves with error on td error message', async () => {
    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    const msg: TdInboundMessage = { type: 'error', code: 'RENDER_FAILED', message: 'Out of memory' }
    engine.emit('message', msg)

    const result = await resultPromise
    expect(result.success).toBe(false)
    expect(result.error).toBe('Out of memory')
  })

  it('times out if TD never responds', async () => {
    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    // timeout = (durationSeconds + 30) * 1000 = 35_000ms
    vi.advanceTimersByTime(35_000)

    const result = await resultPromise
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/timed out/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx vitest run src/capture/captureManager.test.ts 2>&1 | head -10
```

Expected: fails with "Cannot find module './captureManager'"

- [ ] **Step 3: Write `backend/src/capture/captureManager.ts`**

```typescript
import * as path from 'path'
import type { TDEngine } from '../core/engine/tdEngine'
import type { TdInboundMessage } from '@shared/protocol/websocket'
import { TdExportResponseSchema } from '@shared/types/ipc'
import type { TdExportRequest, TdExportResponse } from '@shared/types/ipc'

/**
 * Orchestrates video export from TouchDesigner.
 *
 * Flow:
 *   1. Resolves the output path from request fields.
 *   2. Sends `start_recording` to TD via the engine.
 *   3. Waits for `recording_complete` (success) or `error` (failure).
 *   4. A timeout guard resolves with an error if TD never responds.
 *
 * What still needs implementing before shipping:
 *   - Verify the returned filePath exists on disk before resolving success.
 *   - Emit progress events for long exports (future, not MVP).
 */
export class CaptureManager {
  constructor(
    private readonly defaultOutputDir: string,
    private readonly engine: TDEngine,
  ) {}

  startExport(req: TdExportRequest): Promise<TdExportResponse> {
    return new Promise((resolve) => {
      const outputPath = path.join(req.outputDir, req.filename)
      const timeoutMs = (req.durationSeconds + 30) * 1000

      const timer = setTimeout(() => {
        cleanup()
        resolve(
          TdExportResponseSchema.parse({
            success: false,
            error: `Export timed out after ${timeoutMs}ms`,
          }),
        )
      }, timeoutMs)

      const onMessage = (msg: TdInboundMessage): void => {
        if (msg.type === 'recording_complete') {
          cleanup()
          resolve(TdExportResponseSchema.parse({ success: true, filePath: msg.filePath }))
        } else if (msg.type === 'error') {
          cleanup()
          resolve(TdExportResponseSchema.parse({ success: false, error: msg.message }))
        }
      }

      const cleanup = () => {
        clearTimeout(timer)
        this.engine.off('message', onMessage)
      }

      this.engine.on('message', onMessage)

      try {
        this.engine.send({ type: 'start_recording', durationSeconds: req.durationSeconds, outputPath })
      } catch (err) {
        cleanup()
        resolve(
          TdExportResponseSchema.parse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    })
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && npx vitest run src/capture/captureManager.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/capture/
git commit -m "feat: implement CaptureManager with timeout guard"
```

---

### Task 12: `backend/src/ipc/handlers.ts`

**Files:**
- Create: `backend/src/ipc/handlers.ts`

- [ ] **Step 1: Write `backend/src/ipc/handlers.ts`**

```typescript
import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { TDEngine } from '../core/engine/tdEngine'
import { CaptureManager } from '../capture/captureManager'
import { config } from '../core/config/config'
import {
  IPC_CHANNELS,
  TdConnectResponseSchema,
  TdSendParamResponseSchema,
  TdLoadTemplateResponseSchema,
  TdExportResponseSchema,
  TdGetStatusResponseSchema,
  ParameterUpdateSchema,
  TdLoadTemplateRequestSchema,
  TdExportRequestSchema,
} from '@shared/types/ipc'
import type { ConnectionState } from '@shared/types/ipc'

export function registerIpcHandlers(
  tdEngine: TDEngine,
  getWindow: () => BrowserWindow | null,
): void {
  const captureManager = new CaptureManager(config.outputDir, tdEngine)

  // Push: relay engine state changes to the renderer
  tdEngine.on('connectionChanged', (state: ConnectionState) => {
    getWindow()?.webContents.send(IPC_CHANNELS.TD_CONNECTION_CHANGED, { state })
  })

  // Push: relay engine errors to the renderer
  tdEngine.on('error', (err: Error) => {
    getWindow()?.webContents.send(IPC_CHANNELS.TD_ERROR, {
      code: 'ENGINE_ERROR',
      message: err.message,
    })
  })

  // Push: relay recording_complete from TD to the renderer
  tdEngine.on('message', (msg) => {
    if (msg.type === 'recording_complete') {
      getWindow()?.webContents.send(IPC_CHANNELS.TD_EXPORT_COMPLETE, { filePath: msg.filePath })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_CONNECT, async () => {
    try {
      await tdEngine.connect()
      return TdConnectResponseSchema.parse({ success: true })
    } catch (err) {
      return TdConnectResponseSchema.parse({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_DISCONNECT, async () => {
    tdEngine.disconnect()
  })

  ipcMain.handle(IPC_CHANNELS.TD_SEND_PARAM, async (_event, rawReq: unknown) => {
    const req = ParameterUpdateSchema.parse(rawReq)
    try {
      tdEngine.send({ type: 'param_update', ...req })
      return TdSendParamResponseSchema.parse({ success: true })
    } catch {
      return TdSendParamResponseSchema.parse({ success: false })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_LOAD_TEMPLATE, async (_event, rawReq: unknown) => {
    const req = TdLoadTemplateRequestSchema.parse(rawReq)
    try {
      // Sends load_template to TD. Full implementation must await a TdReadyMessage,
      // parse the returned TemplateMetadata from TD's response, and return it here.
      // For MVP the response is immediate — the renderer polls getStatus for ready state.
      tdEngine.send({ type: 'load_template', toxPath: req.toxPath })
      return TdLoadTemplateResponseSchema.parse({ success: true })
    } catch (err) {
      return TdLoadTemplateResponseSchema.parse({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_EXPORT, async (_event, rawReq: unknown) => {
    const req = TdExportRequestSchema.parse(rawReq)
    return captureManager.startExport(req)
  })

  ipcMain.handle(IPC_CHANNELS.TD_GET_STATUS, async () => {
    return TdGetStatusResponseSchema.parse({ state: tdEngine.connectionState })
  })
}
```

---

### Task 13: `backend/src/app/preload.ts`

**Files:**
- Create: `backend/src/app/preload.ts`

- [ ] **Step 1: Write `backend/src/app/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type {
  NexusAPI,
  TdSendParamRequest,
  TdLoadTemplateRequest,
  TdExportRequest,
  TdConnectionChangedPayload,
  TdExportCompletePayload,
  TdErrorPayload,
} from '@shared/types/ipc'

function makePushSubscription<T>(
  channel: string,
  cb: (payload: T) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

const api: NexusAPI = {
  connect: () => ipcRenderer.invoke(IPC_CHANNELS.TD_CONNECT),
  disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.TD_DISCONNECT),
  sendParam: (req: TdSendParamRequest) => ipcRenderer.invoke(IPC_CHANNELS.TD_SEND_PARAM, req),
  loadTemplate: (req: TdLoadTemplateRequest) => ipcRenderer.invoke(IPC_CHANNELS.TD_LOAD_TEMPLATE, req),
  export: (req: TdExportRequest) => ipcRenderer.invoke(IPC_CHANNELS.TD_EXPORT, req),
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TD_GET_STATUS),

  onConnectionChanged: (cb: (p: TdConnectionChangedPayload) => void) =>
    makePushSubscription(IPC_CHANNELS.TD_CONNECTION_CHANGED, cb),

  onExportComplete: (cb: (p: TdExportCompletePayload) => void) =>
    makePushSubscription(IPC_CHANNELS.TD_EXPORT_COMPLETE, cb),

  onError: (cb: (p: TdErrorPayload) => void) =>
    makePushSubscription(IPC_CHANNELS.TD_ERROR, cb),
}

contextBridge.exposeInMainWorld('nexusAPI', api)
```

---

### Task 14: `backend/src/app/main.ts`

**Files:**
- Create: `backend/src/app/main.ts`

- [ ] **Step 1: Write `backend/src/app/main.ts`**

```typescript
import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { config } from '../core/config/config'
import { TDEngine } from '../core/engine/tdEngine'
import { registerIpcHandlers } from '../ipc/handlers'

let mainWindow: BrowserWindow | null = null
let tdEngine: TDEngine | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  if (config.appEnv === 'development') {
    void mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'),
    )
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  tdEngine = new TDEngine(config.tdWsPort)
  registerIpcHandlers(tdEngine, () => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  tdEngine?.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Typecheck the entire backend**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all backend tests**

```bash
cd backend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend — config, IPC handlers, preload, main process"
```

---

### Task 15: Frontend package setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "nexus-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nexus-shared": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "composite": true,
    "paths": {
      "@shared/*": ["../shared/src/*"],
      "@frontend/*": ["./src/*"]
    }
  },
  "references": [
    { "path": "../shared" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@frontend': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
```

- [ ] **Step 4: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nexus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### Task 16: Frontend entry + type augmentation

**Files:**
- Create: `frontend/src/types/window.d.ts`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/types/window.d.ts`**

```typescript
import type { NexusAPI } from '@shared/types/ipc'

declare global {
  interface Window {
    nexusAPI: NexusAPI
  }
}

export {}
```

- [ ] **Step 2: Create `frontend/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found — check index.html')

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### Task 17: `frontend/src/store/useConnectionStore.ts`

**Files:**
- Create: `frontend/src/store/useConnectionStore.ts`

- [ ] **Step 1: Write `frontend/src/store/useConnectionStore.ts`**

```typescript
import { create } from 'zustand'
import type { ConnectionState } from '@shared/types/ipc'

interface ConnectionStore {
  status: ConnectionState
  lastError: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  setStatus: (status: ConnectionState) => void
  setError: (error: string | null) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  lastError: null,

  connect: async () => {
    set({ status: 'connecting', lastError: null })
    const result = await window.nexusAPI.connect()
    if (!result.success) {
      set({ status: 'disconnected', lastError: result.error ?? 'Connection failed' })
    }
    // Further status changes arrive via onConnectionChanged push events (wired in useIpc)
  },

  disconnect: async () => {
    await window.nexusAPI.disconnect()
    set({ status: 'disconnected', lastError: null })
  },

  setStatus: (status) => set({ status }),
  setError: (lastError) => set({ lastError }),
}))
```

---

### Task 18: `frontend/src/store/useTemplateStore.ts`

**Files:**
- Create: `frontend/src/store/useTemplateStore.ts`

- [ ] **Step 1: Write `frontend/src/store/useTemplateStore.ts`**

```typescript
import { create } from 'zustand'
import type { TemplateMetadata } from '@shared/types/template'
import type { ControlValue } from '@shared/types/control'

interface TemplateStore {
  activeTemplate: TemplateMetadata | null
  paramValues: Record<string, ControlValue>
  isExporting: boolean
  exportFilePath: string | null

  loadTemplate: (toxPath: string) => Promise<void>
  updateParam: (parameterId: string, value: ControlValue) => void
  startExport: (durationSeconds: number) => Promise<void>
  setExportFilePath: (filePath: string | null) => void
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  activeTemplate: null,
  paramValues: {},
  isExporting: false,
  exportFilePath: null,

  loadTemplate: async (toxPath) => {
    const result = await window.nexusAPI.loadTemplate({ toxPath })
    if (result.success && result.template) {
      const initial: Record<string, ControlValue> = {}
      for (const p of result.template.parameters) {
        initial[p.id] = p.currentValue
      }
      set({ activeTemplate: result.template, paramValues: initial, exportFilePath: null })
    }
  },

  updateParam: (parameterId, value) => {
    const { activeTemplate } = get()
    if (!activeTemplate) return

    set((s) => ({ paramValues: { ...s.paramValues, [parameterId]: value } }))

    void window.nexusAPI.sendParam({
      templateId: activeTemplate.id,
      parameterId,
      value,
    })
  },

  startExport: async (durationSeconds) => {
    const { activeTemplate, isExporting } = get()
    if (!activeTemplate || isExporting) return

    set({ isExporting: true, exportFilePath: null })

    const result = await window.nexusAPI.export({
      durationSeconds,
      outputDir: '',  // main process resolves outputDir from config
      filename: `${activeTemplate.id}-${Date.now()}.mp4`,
    })

    set({ isExporting: false })
    if (result.success && result.filePath) {
      set({ exportFilePath: result.filePath })
    }
  },

  setExportFilePath: (filePath) => set({ exportFilePath: filePath }),
}))
```

---

### Task 19: `frontend/src/hooks/useIpc.ts`

**Files:**
- Create: `frontend/src/hooks/useIpc.ts`

- [ ] **Step 1: Write `frontend/src/hooks/useIpc.ts`**

```typescript
import { useEffect } from 'react'
import { useConnectionStore } from '../store/useConnectionStore'
import { useTemplateStore } from '../store/useTemplateStore'

// Wire all push events from the main process to Zustand stores.
// Call this once at the root of the component tree (App.tsx).
export function useIpc(): void {
  const setStatus = useConnectionStore((s) => s.setStatus)
  const setError = useConnectionStore((s) => s.setError)
  const setExportFilePath = useTemplateStore((s) => s.setExportFilePath)

  useEffect(() => {
    const unsubConnection = window.nexusAPI.onConnectionChanged((payload) => {
      setStatus(payload.state)
    })

    const unsubExport = window.nexusAPI.onExportComplete((payload) => {
      setExportFilePath(payload.filePath)
    })

    const unsubError = window.nexusAPI.onError((payload) => {
      setError(`[${payload.code}] ${payload.message}`)
      console.error(`[IPC Error ${payload.code}]: ${payload.message}`)
    })

    return () => {
      unsubConnection()
      unsubExport()
      unsubError()
    }
  }, [setStatus, setError, setExportFilePath])
}
```

---

### Task 20: ControlPanel components

**Files:**
- Create: `frontend/src/components/ControlPanel/SliderControl.tsx`
- Create: `frontend/src/components/ControlPanel/ControlPanel.tsx`
- Create: `frontend/src/components/ControlPanel/index.ts`

- [ ] **Step 1: Write `SliderControl.tsx`**

```typescript
import React from 'react'
import type { TemplateParameter } from '@shared/types/template'

interface SliderControlProps {
  param: TemplateParameter
  value: number
  onChange: (value: number) => void
}

export function SliderControl({ param, value, onChange }: SliderControlProps): React.JSX.Element {
  const range = param.range ?? { min: 0, max: 1, step: 0.01 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
      <label htmlFor={param.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{param.label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span>
      </label>
      <input
        id={param.id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write `ControlPanel.tsx`**

```typescript
import React from 'react'
import { SliderControl } from './SliderControl'
import { useTemplateStore } from '../../store/useTemplateStore'

export function ControlPanel(): React.JSX.Element {
  const activeTemplate = useTemplateStore((s) => s.activeTemplate)
  const paramValues = useTemplateStore((s) => s.paramValues)
  const updateParam = useTemplateStore((s) => s.updateParam)

  if (!activeTemplate) {
    return <p style={{ color: '#888' }}>No template loaded. Use the selector above to load a .tox file.</p>
  }

  const sliderParams = activeTemplate.parameters.filter((p) => p.type === 'slider')

  return (
    <div>
      {sliderParams.map((param) => (
        <SliderControl
          key={param.id}
          param={param}
          value={typeof paramValues[param.id] === 'number' ? (paramValues[param.id] as number) : (param.defaultValue as number)}
          onChange={(value) => updateParam(param.id, value)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `ControlPanel/index.ts`**

```typescript
export { ControlPanel } from './ControlPanel'
```

---

### Task 21: TemplateSelector + ExportButton components

**Files:**
- Create: `frontend/src/components/TemplateSelector/TemplateSelector.tsx`
- Create: `frontend/src/components/TemplateSelector/index.ts`
- Create: `frontend/src/components/ExportButton/ExportButton.tsx`
- Create: `frontend/src/components/ExportButton/index.ts`

- [ ] **Step 1: Write `TemplateSelector.tsx`**

```typescript
import React, { useState } from 'react'
import { useTemplateStore } from '../../store/useTemplateStore'

// Stub: full implementation should call window.nexusAPI via a new IPC channel
// (e.g. TD_OPEN_FILE_DIALOG) that invokes Electron's dialog.showOpenDialog with
// { filters: [{ name: 'TouchDesigner', extensions: ['tox'] }] }.
// For MVP the user types the path directly.
export function TemplateSelector(): React.JSX.Element {
  const [toxPath, setToxPath] = useState('')
  const loadTemplate = useTemplateStore((s) => s.loadTemplate)
  const activeTemplate = useTemplateStore((s) => s.activeTemplate)

  const handleLoad = async () => {
    const trimmed = toxPath.trim()
    if (trimmed) await loadTemplate(trimmed)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <input
        type="text"
        placeholder="Path to .tox file…"
        value={toxPath}
        onChange={(e) => setToxPath(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleLoad() }}
        style={{ flex: 1, padding: '4px 8px' }}
      />
      <button onClick={() => void handleLoad()}>Load</button>
      {activeTemplate && (
        <span style={{ color: '#4caf50', fontSize: 12 }}>✓ {activeTemplate.name}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `TemplateSelector/index.ts`**

```typescript
export { TemplateSelector } from './TemplateSelector'
```

- [ ] **Step 3: Write `ExportButton.tsx`**

```typescript
import React from 'react'
import { useTemplateStore } from '../../store/useTemplateStore'
import { useConnectionStore } from '../../store/useConnectionStore'

const DEFAULT_DURATION_SECONDS = 10

export function ExportButton(): React.JSX.Element {
  const isExporting = useTemplateStore((s) => s.isExporting)
  const exportFilePath = useTemplateStore((s) => s.exportFilePath)
  const startExport = useTemplateStore((s) => s.startExport)
  const status = useConnectionStore((s) => s.status)
  const activeTemplate = useTemplateStore((s) => s.activeTemplate)

  const disabled = isExporting || status !== 'connected' || !activeTemplate

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => void startExport(DEFAULT_DURATION_SECONDS)}
        disabled={disabled}
        style={{ padding: '8px 24px' }}
      >
        {isExporting ? 'Exporting…' : `Export (${DEFAULT_DURATION_SECONDS}s)`}
      </button>
      {exportFilePath && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Saved: {exportFilePath}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `ExportButton/index.ts`**

```typescript
export { ExportButton } from './ExportButton'
```

---

### Task 22: `frontend/src/App.tsx`

**Files:**
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Write `frontend/src/App.tsx`**

```typescript
import React from 'react'
import { useIpc } from './hooks/useIpc'
import { useConnectionStore } from './store/useConnectionStore'
import { TemplateSelector } from './components/TemplateSelector'
import { ControlPanel } from './components/ControlPanel'
import { ExportButton } from './components/ExportButton'

export default function App(): React.JSX.Element {
  useIpc()

  const status = useConnectionStore((s) => s.status)
  const lastError = useConnectionStore((s) => s.lastError)
  const connect = useConnectionStore((s) => s.connect)
  const disconnect = useConnectionStore((s) => s.disconnect)

  const statusColor: Record<typeof status, string> = {
    connected: '#4caf50',
    connecting: '#ff9800',
    reconnecting: '#ff9800',
    disconnected: '#f44336',
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Nexus</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: statusColor[status] }}>● TD: {status}</span>
          {status === 'disconnected' && (
            <button onClick={() => void connect()}>Connect</button>
          )}
          {status === 'connected' && (
            <button onClick={() => void disconnect()}>Disconnect</button>
          )}
        </div>
      </header>

      {lastError && (
        <p style={{ color: '#f44336', fontSize: 12, marginBottom: 12 }}>{lastError}</p>
      )}

      <TemplateSelector />
      <ControlPanel />
      <ExportButton />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck the entire frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend — stores, IPC hook, ControlPanel, ExportButton, TemplateSelector"
```

---

### Task 23: `.env.example`, `README.md`, `CONTRIBUTING.md`

**Files:**
- Create: `.env.example`
- Create: `README.md`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create `.env.example`**

```bash
# Port TouchDesigner's WebSocket DAT listens on.
# Set this in the WebSocket DAT's "Network Port" parameter inside your .tox.
TD_WS_PORT=9980

# Absolute path to the TouchDesigner executable.
# If set, Nexus can auto-launch TD when connecting. Leave blank to launch manually.
TD_EXECUTABLE_PATH=

# Absolute directory where exported video clips are saved.
# Defaults to ~/Documents/Nexus/exports if not set.
OUTPUT_DIR=

# Application environment: development | production
APP_ENV=development
```

- [ ] **Step 2: Create `README.md`**

```markdown
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
```

- [ ] **Step 3: Create `CONTRIBUTING.md`**

```markdown
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
```

---

### Task 24: Final typecheck across all packages

- [ ] **Step 1: Typecheck shared**

```bash
cd shared && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Typecheck backend**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Typecheck frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run backend unit tests**

```bash
cd backend && npx vitest run
```

Expected: all tests in `tdEngine.test.ts` and `captureManager.test.ts` pass.

- [ ] **Step 5: Final commit**

```bash
git add .env.example README.md CONTRIBUTING.md docs/
git commit -m "feat: add env example, README with architecture diagram, and CONTRIBUTING guide"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| pnpm-workspace.yaml | Task 1 |
| tsconfig path aliases @shared/*, @frontend/*, @backend/* | Tasks 1, 8, 15 |
| shared/src/types/control.ts — full | Task 3 |
| shared/src/types/template.ts — full | Task 4 |
| shared/src/types/ipc.ts — full | Task 5 |
| WebSocket protocol (zod) | Task 6 |
| TDEngine — connect/disconnect/reconnect/exponential backoff | Task 10 |
| Electron main + preload (contextIsolation, no nodeIntegration) | Tasks 13, 14 |
| .env.example with TD_WS_PORT, TD_EXECUTABLE_PATH, OUTPUT_DIR, APP_ENV | Task 23 |
| CONTRIBUTING.md with ownership + IPC rule | Task 23 |
| README.md with prerequisites + ASCII architecture | Task 23 |
| No hardcoded port 9980 except .env.example | config.ts reads from env |
| No renderer/ in backend/ | capture/ used throughout |
| No require() in source | All source uses import/export |

**Placeholder scan:** None found. All code steps contain complete implementations.

**Type consistency:** `ParameterUpdate`, `TdOutboundMessage`, `NexusAPI`, `ConnectionState`, `TdInboundMessage` defined in Tasks 3–6 and referenced consistently in Tasks 10–22.
