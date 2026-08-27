import puppeteer from 'puppeteer-core'

const FOLDER = '4e7d7853-e417-4c13-9dfd-af9b3555f591'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
// 拦截 window.print，让分页 DOM 保留
await page.evaluateOnNewDocument(() => {
  window.print = () => { window.__printed = true }
})

await page.goto('http://localhost:8123/#/folder/' + FOLDER, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.doc-card', { timeout: 30000 })
console.log('页面加载完成，文档卡片:', await page.$$eval('.doc-card', (els) => els.length))

// 点击“下载全部 PDF”
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('下载全部 PDF'))
  if (btn) btn.click()
})
await page.waitForSelector('.print-page', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 2000))

const diag = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.print-page')]
  const info = pages.map((p, i) => {
    const lines = [...p.querySelectorAll('.code-ln')]
    const srcLines = [...p.querySelectorAll('.src-line')].length
    return {
      page: i + 1,
      clientH: p.clientHeight,
      scrollH: p.scrollHeight,
      overflow: p.scrollHeight > p.clientHeight + 1,
      codeRows: lines.length,
      firstLn: lines[0] ? lines[0].textContent : null,
      lastLn: lines.length ? lines[lines.length - 1].textContent : null,
      srcRows: srcLines,
    }
  })
  return { pageCount: pages.length, printed: !!window.__printed, pages: info }
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
