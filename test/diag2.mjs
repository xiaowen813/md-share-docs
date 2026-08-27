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
  // 统计
  const codeLineHeights = [...document.querySelectorAll('.print-page .code-line')].map((l) => l.offsetHeight)
  const maxLine = Math.max(...codeLineHeights)
  const singleLinePages = pages.filter((p) => p.querySelectorAll('.code-line').length === 1 && p.scrollHeight > 1010)
  // 第一个溢出页的块明细
  const overIdx = pages.findIndex((p) => p.scrollHeight > p.clientHeight + 1)
  let blockDetail = null
  if (overIdx >= 0) {
    const p = pages[overIdx]
    blockDetail = [...p.children].map((c) => {
      const cs = getComputedStyle(c)
      return {
        tag: c.tagName,
        cls: c.className,
        h: c.offsetHeight,
        mt: cs.marginTop,
        mb: cs.marginBottom,
        lines: c.querySelectorAll('.code-line').length,
        firstLn: c.querySelector('.code-ln')?.textContent || null,
      }
    })
  }
  return {
    pageCount: pages.length,
    codeLineCount: codeLineHeights.length,
    maxLineH: maxLine,
    maxLinePage: pages.findIndex((p) => [...p.querySelectorAll('.code-line')].some((l) => l.offsetHeight === maxLine)),
    overflowPages: pages.filter((p) => p.scrollHeight > p.clientHeight + 1).length,
    singleLineOverflowPages: singleLinePages.length,
    overIdx,
    blockDetail,
    pageLineCounts: pages.slice(0, 12).map((p) => p.querySelectorAll('.code-line').length),
  }
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
