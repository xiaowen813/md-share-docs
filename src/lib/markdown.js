import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'
import 'highlight.js/styles/atom-one-dark.css'

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

marked.setOptions({
  gfm: true,
  breaks: true,
})

// 渲染 Markdown → 安全的 HTML（先 marked 再 DOMPurify 消毒，防止 XSS）
export function renderMarkdown(src) {
  const raw = marked.parse(src || '')
  return DOMPurify.sanitize(raw)
}
