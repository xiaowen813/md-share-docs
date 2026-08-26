import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'
import katex from 'katex'
import emojiData from 'markdown-it-emoji/lib/data/full.mjs'

// ---------- 代码高亮语言注册 ----------
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
  ['javascript', javascript], ['typescript', typescript], ['python', python],
  ['java', java], ['c', c], ['cpp', cpp], ['csharp', csharp], ['go', go],
  ['rust', rust], ['php', php], ['ruby', ruby], ['swift', swift], ['kotlin', kotlin],
  ['sql', sql], ['bash', bash], ['shell', bash], ['json', json], ['xml', xml],
  ['html', xml], ['css', css], ['scss', scss], ['markdown', markdown],
  ['yaml', yaml], ['plaintext', plaintext],
]) {
  hljs.registerLanguage(name, lang)
}

// ---------- 代码块高亮 ----------
// 给高亮后的每一行前面插入行号标记（编辑预览/阅读/打印都会显示）
function addLineNumbers(highlightedHtml) {
  return highlightedHtml
    .split('\n')
    .map((line, i) => `<span class="code-ln">${i + 1}</span>${line}`)
    .join('\n')
}

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return addLineNumbers(hljs.highlight(code, { language }).value)
    },
  })
)

// ---------- LaTeX 数学公式 ----------
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

// ---------- ==高亮== ----------
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

// ---------- ^上标^ ----------
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

// ---------- ~下标~（单波浪是下标，双波浪 ~~ 仍是删除线） ----------
const subscript = {
  name: 'subscript',
  level: 'inline',
  start(src) {
    const i = src.indexOf('~')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    if (src.startsWith('~~')) return undefined // 双波浪留给删除线
    const match = src.match(/^~([^\s~]+?)~/)
    if (match) return { type: 'subscript', raw: match[0], text: match[1] }
  },
  renderer(token) {
    return `<sub>${token.text}</sub>`
  },
}

// ---------- 脚注 ----------
const footnoteRef = {
  name: 'footnoteRef',
  level: 'inline',
  start(src) {
    const i = src.indexOf('[^')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    const match = src.match(/^\[\^([^\]]+)\]/)
    if (match) return { type: 'footnoteRef', raw: match[0], id: match[1] }
  },
  renderer(token) {
    return `<sup class="footnote-ref" id="fnref-${token.id}"><a href="#fn-${token.id}">${token.id}</a></sup>`
  },
}

const footnoteDef = {
  name: 'footnoteDef',
  level: 'block',
  start(src) {
    return src.startsWith('[^') ? 0 : undefined
  },
  tokenizer(src) {
    const match = src.match(/^\[\^([^\]]+)\]:\s*([^\n]+)(?:\n[ \t]+([^\n]+))*\n?/)
    if (!match) return undefined
    return { type: 'footnoteDef', raw: match[0], id: match[1], lines: match.slice(2).filter(Boolean) }
  },
  renderer(token) {
    const items = token.lines
      .map((l) => `<li id="fn-${token.id}">${marked.parseInline(l)} <a class="footnote-back" href="#fnref-${token.id}">↩</a></li>`)
      .join('')
    return `<div class="footnotes"><hr><ol>${items}</ol></div>`
  },
}

// ---------- 定义列表 ----------
const defList = {
  name: 'defList',
  level: 'block',
  start(src) {
    const m = src.match(/^[^\n]+\n[ \t]*:[ \t]+/)
    return m ? 0 : undefined
  },
  tokenizer(src) {
    const match = src.match(/^([^\n]+)\n((?:[ \t]*:[ \t]+[^\n]+(?:\n|$)){1,})/)
    if (!match) return undefined
    return {
      type: 'defList',
      raw: match[0],
      dt: match[1].trim(),
      dds: match[2].split('\n').map((l) => l.replace(/^\s*:[ \t]+/, '').trim()).filter(Boolean),
    }
  },
  renderer(token) {
    const dds = token.dds.map((d) => `<dd>${marked.parseInline(d)}</dd>`).join('')
    return `<dl><dt>${marked.parseInline(token.dt)}</dt>${dds}</dl>`
  },
}

// ---------- emoji 简码 ----------
const emojiExt = {
  name: 'emoji',
  level: 'inline',
  start(src) {
    const i = src.indexOf(':')
    return i === -1 ? undefined : i
  },
  tokenizer(src) {
    const match = src.match(/^:([a-zA-Z0-9_+\-]+):/)
    if (match && emojiData[match[1]]) return { type: 'emoji', raw: match[0], emoji: emojiData[match[1]] }
  },
  renderer(token) {
    return token.emoji
  },
}

// ---------- Mermaid 图 ----------
const mermaidBlock = {
  name: 'mermaidBlock',
  level: 'block',
  start(src) {
    return src.startsWith('\`\`\`mermaid') ? 0 : undefined
  },
  tokenizer(src) {
    const match = src.match(/^\`\`\`mermaid\s*\n([\s\S]+?)\`\`\`/)
    if (!match) return undefined
    return { type: 'mermaidBlock', raw: match[0], text: match[1].trim() }
  },
  renderer(token) {
    const esc = token.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<div class="mermaid">${esc}</div>`
  },
}

marked.use({ extensions: [inlineMath, blockMath, highlightText, superscript, subscript, footnoteRef, footnoteDef, defList, emojiExt, mermaidBlock] })

marked.setOptions({
  gfm: true,
  breaks: true,
})

// ---------- [TOC] 目录 ----------
function insertToc(html) {
  if (!html.includes('[TOC]')) return html
  const doc = typeof document !== 'undefined' ? document : window.document
  const tmp = doc.createElement('div')
  tmp.innerHTML = html
  const headings = Array.from(tmp.querySelectorAll('h1, h2, h3'))
  const used = new Map()
  headings.forEach((h) => {
    const base = (h.textContent || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '') || 'section'
    const n = used.get(base) || 0
    used.set(base, n + 1)
    h.id = n === 0 ? base : `${base}-${n}`
  })
  const toc = doc.createElement('details')
  toc.className = 'toc'
  toc.open = true
  const summary = doc.createElement('summary')
  summary.textContent = '📑 目录'
  const ul = doc.createElement('ul')
  headings.forEach((h) => {
    const li = doc.createElement('li')
    li.className = 'toc-level-' + h.tagName[1]
    const a = doc.createElement('a')
    a.href = '#' + h.id
    a.textContent = h.textContent
    li.appendChild(a)
    ul.appendChild(li)
  })
  toc.appendChild(summary)
  toc.appendChild(ul)
  tmp.querySelectorAll('p').forEach((p) => {
    if (p.textContent.trim() === '[TOC]') p.replaceWith(toc.cloneNode(true))
  })
  return tmp.innerHTML
}

// ---------- DOMPurify ----------
function getSanitizer() {
  if (typeof DOMPurify.sanitize === 'function') return DOMPurify
  if (typeof DOMPurify === 'function' && DOMPurify.length >= 1) return DOMPurify(window)
  if (typeof DOMPurify.createDOMPurify === 'function') return DOMPurify.createDOMPurify(window)
  return DOMPurify
}

// 渲染 Markdown → 安全的 HTML
export function renderMarkdown(src) {
  const raw = marked.parse(src || '')
  const clean = getSanitizer().sanitize(raw)
  return insertToc(clean)
}
