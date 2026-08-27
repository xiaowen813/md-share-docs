import puppeteer from 'puppeteer-core'

const FOLDER = '4e7d7853-e417-4c13-9dfd-af9b3555f591'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
})
const page = await browser.newPage()
page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)))
await page.setViewport({ width: 1280, height: 900 })
await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })
await page.goto('http://localhost:8123/#/folder/' + FOLDER, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.doc-card', { timeout: 30000 })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('下载全部 PDF'))
  if (btn) btn.click()
})
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const n = await page.evaluate(() => document.querySelectorAll('.print-page').length)
  if (n > 0) break
}
await new Promise((r) => setTimeout(r, 3000))
const diag = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.print-page')]
  const p215 = pages[214]
  return {
    pageCount: pages.length,
    page215HasNum: !!p215.querySelector('.print-page-num'),
    page215ScrollH: p215.scrollHeight,
    tocPageTexts: [...document.querySelectorAll('.print-toc .toc-page')].slice(0, 4).map((t) => t.textContent),
    lastPageHasNum: !!pages[pages.length - 1].querySelector('.print-page-num'),
    printed: !!window.__printed,
  }
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
