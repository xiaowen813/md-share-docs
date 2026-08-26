import { JSDOM } from 'jsdom'
import { renderMarkdown } from '../src/lib/markdownCore.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const md = '```js\nconst x = 1;\nconsole.log(x)\n\n// 注释行\n```'
const html = renderMarkdown(md)
console.log(html)
