import puppeteer from 'puppeteer-core'

const FOLDER = '4e7d7853-e417-4c13-9dfd-af9b3555f591'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
})
const page = await browser.newPage()
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 300)) })
page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)))
await page.setViewport({ width: 1280, height: 900 })
await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })
await page.goto('http://localhost:8123/#/folder/' + FOLDER, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.doc-card', { timeout: 30000 })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('下载全部 PDF'))
  if (btn) btn.click()
})
try {
  await page.waitForSelector('.print-page', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 2500))
  const diag = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('.print-page')]
    return {
      pageCount: pages.length,
      overflowPages: pages.filter((p) => p.scrollHeight > p.clientHeight + 1).length,
    }
  })
  console.log(JSON.stringify(diag))
} catch (e) {
  console.log('等待 .print-page 超时:', String(e).slice(0, 200))
}
await browser.close()
