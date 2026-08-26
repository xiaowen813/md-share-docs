import { JSDOM } from 'jsdom'
import { renderMarkdown } from '../src/lib/markdownCore.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const md = '```js\nconst s = `line1\nline2\nline3`;\n\n/* 多行\n注释 */\nfunction f() {\n  return s\n}\n```'
const html = renderMarkdown(md)
console.log(html)
console.log('---')
console.log('code-line 数量:', (html.match(/code-line/g) || []).length)
