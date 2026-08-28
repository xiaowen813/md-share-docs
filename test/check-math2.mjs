import { JSDOM } from 'jsdom'
import { renderMarkdown } from '../src/lib/markdownCore.js'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const cases = {
  '数字开头公式': '公式 $2^{\\log{\\phi(p)}-1}$ 正常渲染',
  '转义美元': '价格 \\$5，字面 \\$2^x\\$ 显示文本',
  '普通公式': '公式 $x^2$ 和块级 $$\\frac{1}{2}$$',
}
for (const [n, md] of Object.entries(cases)) {
  const html = renderMarkdown(md)
  console.log('---', n, '---')
  console.log('含katex:', html.includes('katex'))
  console.log(html.slice(0, 180))
}
