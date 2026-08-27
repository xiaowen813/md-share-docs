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
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const n = await page.evaluate(() => document.querySelectorAll('.print-page').length)
  if (n > 0) break
}
await new Promise((r) => setTimeout(r, 2000))
const diag = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.print-page')]
  const targets = [214, 220, 244, 250]
  return targets.map((idx) => {
    const p = pages[idx]
    if (!p) return { page: idx + 1, missing: true }
    const blocks = [...p.children].filter((c) => !c.classList.contains('print-page-num'))
    return {
      page: idx + 1,
      scrollH: p.scrollHeight,
      blocks: blocks.length,
      blockTypes: blocks.map((b) => ({
        cls: String(b.className).slice(0, 20),
        h: b.offsetHeight,
        lines: b.querySelectorAll('.code-line, .src-line').length,
      })),
    }
  })
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
