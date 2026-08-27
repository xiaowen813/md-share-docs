import puppeteer from 'puppeteer-core'

const FOLDER = '4e7d7853-e417-4c13-9dfd-af9b3555f591'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })
await page.goto('http://localhost:8123/#/folder/' + FOLDER, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.doc-card', { timeout: 30000 })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('下载全部 PDF'))
  if (btn) btn.click()
})
// 等待分页完成（healPages 可能较慢，轮询等待）
let done = false
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const n = await page.evaluate(() => document.querySelectorAll('.print-page').length)
  if (n > 0) { done = true; break }
}
await new Promise((r) => setTimeout(r, 2000))
const diag = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.print-page')]
  const over = pages.filter((p) => p.scrollHeight > p.clientHeight + 1)
  return {
    done: true,
    pageCount: pages.length,
    overflowPages: over.length,
    overflowPageNos: over.map((p) => pages.indexOf(p) + 1).slice(0, 15),
  }
})
console.log(JSON.stringify(diag))
await browser.close()
