import puppeteer from 'puppeteer-core'

const FOLDER = '4e7d7853-e417-4c13-9dfd-af9b3555f591'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
})
const page = await browser.newPage()
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text().slice(0, 400)))
page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 800)))
await page.setViewport({ width: 1280, height: 900 })
await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })
await page.goto('http://localhost:8123/#/folder/' + FOLDER, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.doc-card', { timeout: 30000 })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('下载全部 PDF'))
  if (btn) btn.click()
})
await new Promise((r) => setTimeout(r, 4000))
const state = await page.evaluate(() => {
  return {
    errorText: document.querySelector('.error')?.textContent || null,
    printOnly: !!document.querySelector('.print-only'),
    printPages: document.querySelectorAll('.print-page').length,
    buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8),
  }
})
console.log(JSON.stringify(state, null, 1))
await browser.close()
