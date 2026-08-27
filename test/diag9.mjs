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
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const n = await page.evaluate(() => document.querySelectorAll('.print-page').length)
  if (n > 0) break
}
await new Promise((r) => setTimeout(r, 3000))
const diag = await page.evaluate(() => {
  const p = [...document.querySelectorAll('.print-page')][214]
  const blocks = [...p.children].filter((c) => !c.classList.contains('print-page-num'))
  const detail = blocks.map((b) => ({
    top: b.offsetTop,
    h: b.offsetHeight,
    bottom: b.offsetTop + b.offsetHeight,
    cls: String(b.className).slice(0, 25),
  }))
  // 模拟 heal 检测：最后一个块 bottom > PAGE_H(985) 吗？
  const last = blocks[blocks.length - 1]
  const lastOver = last ? last.offsetTop + last.offsetHeight > 985 : false
  // 手动移动最后块到下一页，验证 scrollHeight 变化
  const before = p.scrollHeight
  let after = before
  if (last) {
    const next = [...document.querySelectorAll('.print-page')][215]
    next.insertBefore(last, next.querySelector('.print-page-num') || null)
    after = p.scrollHeight
  }
  return { detail, lastOver, before, after }
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
