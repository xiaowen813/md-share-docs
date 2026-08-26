import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'
import katex from 'katex'

// 按需注册常用语言（减小打包体积）
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import plaintext from 'highlight.js/lib/languages/plaintext'

for (const [name, lang] of [
  ['javascript', javascript],
  ['typescript', typescript],
  ['python', python],
  ['java', java],
  ['c', c],
  ['cpp', cpp],
  ['csharp', csharp],
  ['go', go],
  ['rust', rust],
  ['php', php],
  ['ruby', ruby],
  ['swift', swift],
  ['kotlin', kotlin],
  ['sql', sql],
  ['bash', bash],
  ['shell', bash],
  ['json', json],
  ['xml', xml],
  ['html', xml],
  ['css', css],
  ['scss', scss],
  ['markdown', markdown],
  ['yaml', yaml],
  ['plaintext', plaintext],
]) {
  hljs.registerLanguage(name, lang)
}

// 代码块语法高亮（VSCode 风格配色，由 atom-one-dark 主题提供）
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  })
)

// LaTeX 数学公式：$...$ 行内公式、$$...$$ 块级公式（KaTeX 渲染）
const inlineMath = {
  name: 'inlineMath',
  level: 'inline',
  start(src) {
    const i = src.indexOf('$')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    const match = src.match(/^\$([^$\n]+?)\$/)
    if (match) return { type: 'inlineMath', raw: match[0], text: match[1] }
  },
  renderer(token) {
    return katex.renderToString(token.text, { throwOnError: false, displayMode: false })
  },
}

const blockMath = {
  name: 'blockMath',
  level: 'block',
  start(src) {
    const i = src.indexOf('$$')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/)
    if (match) return { type: 'blockMath', raw: match[0], text: match[1] }
  },
  renderer(token) {
    return `<div class="katex-display">${katex.renderToString(token.text, { throwOnError: false, displayMode: true })}</div>`
  },
}

// 高亮 ==text== → <mark>（常见扩展语法）
const highlightText = {
  name: 'highlightText',
  level: 'inline',
  start(src) {
    const i = src.indexOf('==')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    const match = src.match(/^==([^=\n]+?)==/)
    if (match) return { type: 'highlightText', raw: match[0], text: match[1] }
  },
  renderer(token) {
    return `<mark>${token.text}</mark>`
  },
}

// 上标 ^text^ → <sup>（pandoc 风格）
const superscript = {
  name: 'superscript',
  level: 'inline',
  start(src) {
    const i = src.indexOf('^')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    const match = src.match(/^\^([^\s^]+?)\^/)
    if (match) return { type: 'superscript', raw: match[0], text: match[1] }
  },
  renderer(token) {
    return `<sup>${token.text}</sup>`
  },
}

marked.use({ extensions: [inlineMath, blockMath, highlightText, superscript] })

marked.setOptions({
  gfm: true,
  breaks: true,
})

// 浏览器环境直接可用；Node 测试环境通过工厂函数构造
function getSanitizer() {
  if (typeof DOMPurify.sanitize === 'function') return DOMPurify
  if (typeof DOMPurify === 'function' && DOMPurify.length >= 1) return DOMPurify(window)
  if (typeof DOMPurify.createDOMPurify === 'function') return DOMPurify.createDOMPurify(window)
  return DOMPurify
}

// 渲染 Markdown → 安全的 HTML（先 marked 再 DOMPurify 消毒，防止 XSS）
export function renderMarkdown(src) {
  const raw = marked.parse(src || '')
  return getSanitizer().sanitize(raw)
}
