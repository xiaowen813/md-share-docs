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
await page.waitForSelector('.print-page', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 2000))

const diag = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.print-page')]
  const p = pages[3] // 第 4 页（溢出页）
  // 模拟 used 计算：块 offsetHeight + margin
  let used = 0
  const detail = [...p.children]
    .filter((c) => !c.classList.contains('print-page-num'))
    .map((c) => {
      const cs = getComputedStyle(c)
      const mt = parseFloat(cs.marginTop) || 0
      const mb = parseFloat(cs.marginBottom) || 0
      const h = c.offsetHeight + mt + mb
      used += h
      return {
        cls: String(c.className).slice(0, 40),
        offsetH: c.offsetHeight,
        mt, mb, h,
        firstLn: c.querySelector('.code-ln')?.textContent || null,
        lastLn: (() => { const ls = [...c.querySelectorAll('.code-ln')]; return ls.length ? ls[ls.length - 1].textContent : null })(),
      }
    })
  // 找出超出 1010 的行
  const overflowLines = [...p.querySelectorAll('.code-line')]
    .map((l) => ({ n: l.querySelector('.code-ln')?.textContent, top: l.offsetTop, h: l.offsetHeight }))
    .filter((l) => l.top + l.h > 1010)
  return {
    scrollH: p.scrollHeight,
    clientH: p.clientHeight,
    blocksUsedSum: used,
    blockCount: detail.length,
    detail,
    overflowLines: overflowLines.slice(0, 12),
  }
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
