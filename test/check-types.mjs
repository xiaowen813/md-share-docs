import { JSDOM } from 'jsdom'
import { renderDocument } from '../src/lib/markdownCore.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const tex = '\\documentclass{article}\n\\title{测试}\n\n公式 $a^2 + b^2 = c^2$ 和 $$\\int_0^1 x\\,dx = \\frac{1}{2}$$\n\n\\begin{enumerate}\n  \\item 第一项\n\\end{enumerate}'
const typ = '# 标题\n\n这是 $x^2$ 公式。\n\n== 高亮 =='

console.log('=== LaTeX ===')
console.log(renderDocument(tex, 'latex').slice(0, 400))
console.log('=== Typst ===')
console.log(renderDocument(typ, 'typst').slice(0, 300))
console.log('=== 含 katex 渲染 ===')
console.log('latex 含 katex:', renderDocument(tex, 'latex').includes('katex'))
