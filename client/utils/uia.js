import { runPowerShellRaw } from './osHelper.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENGINE = path.resolve(__dirname, 'uia_engine.ps1')

async function callEngine(payload) {
  const json = JSON.stringify(payload).replace(/'/g, "\\'")
  const result = await runPowerShellRaw(ENGINE, json)
  try {
    return JSON.parse(result)
  } catch {
    return { success: false, error: `Invalid engine output: ${result}` }
  }
}

export async function focusApp(appName) {
  return callEngine({ action: 'focus_window', app: appName })
}

export async function clickElement(appName, selector) {
  return callEngine({ action: 'find_and_click', app: appName, selector })
}

export async function typeInto(appName, selector, value) {
  return callEngine({ action: 'find_and_type', app: appName, selector, value })
}

export async function readElement(appName, selector) {
  return callEngine({ action: 'find_and_read', app: appName, selector })
}

export async function getWindowTree(appName, depth = 3) {
  return callEngine({ action: 'get_window_tree', app: appName, depth })
}

export async function captureWindow(appName) {
  return callEngine({ action: 'capture_window', app: appName })
}
