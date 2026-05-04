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
