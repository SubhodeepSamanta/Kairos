import { focusApp, clickElement, typeInto, captureWindow } from '../utils/uia.js'
import sharp from 'sharp'
import fs from 'fs'

async function compressScreenshot(filePath) {
  const raw = fs.readFileSync(filePath)
  const compressed = await sharp(raw)
    .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer()
  try { await fs.promises.unlink(filePath) } 
  catch (e) { console.error('Cleanup failed:', filePath, e.message) }
  return compressed.toString('base64')
}

export async function sendText(recipient, message) {
  await focusApp('WhatsApp')
  await new Promise(r => setTimeout(r, 300))
  await clickElement('WhatsApp', { name: 'Search', controlType: 'Edit' })
  await typeInto('WhatsApp', { controlType: 'Edit' }, recipient)
  await new Promise(r => setTimeout(r, 1500))
  await clickElement('WhatsApp', { controlType: 'ListItem' })
  await new Promise(r => setTimeout(r, 500))
  await typeInto('WhatsApp', { name: 'Type a message', controlType: 'Edit' }, message)
  await clickElement('WhatsApp', { name: 'Send', controlType: 'Button' })
  return `Sent "${message}" to ${recipient}`
}

export async function checkStatuses() {
  await focusApp('WhatsApp')
  await new Promise(r => setTimeout(r, 300))
  await clickElement('WhatsApp', { name: 'Status', controlType: 'ListItem' })
  await new Promise(r => setTimeout(r, 1000))
  const capture = await captureWindow('WhatsApp')
  if (!capture.success) throw new Error(capture.error)
  return compressScreenshot(capture.result)
}

export async function readLastConversation(recipient) {
  await focusApp('WhatsApp')
  await new Promise(r => setTimeout(r, 300))
  await clickElement('WhatsApp', { name: 'Search', controlType: 'Edit' })
  await typeInto('WhatsApp', { controlType: 'Edit' }, recipient)
  await new Promise(r => setTimeout(r, 1500))
  await clickElement('WhatsApp', { controlType: 'ListItem' })
  await new Promise(r => setTimeout(r, 800))
  const capture = await captureWindow('WhatsApp')
  if (!capture.success) throw new Error(capture.error)
  return compressScreenshot(capture.result)
}

export async function readWhatsAppStatus(recipient) {
  return readLastConversation(recipient)
}
