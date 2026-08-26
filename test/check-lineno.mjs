import { JSDOM } from 'jsdom'
import { renderMarkdown } from '../src/lib/markdownCore.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const md = '```python\ndef add(a, b):\n    return a + b\n\n\n# 空行上面有两个换行\nprint(add(1, 2))\n```'
const html = renderMarkdown(md)
console.log(html)
