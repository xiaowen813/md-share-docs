import { marked } from 'marked'
import '../src/lib/markdownCore.js'
const md = '正文含 & % # _ ~ ^ $ { } 和 **粗体** 与 *斜体*，行内代码 \`a_b#c\`，公式 $x^2$。'
const toks = marked.lexer(md)
const p = toks[0]
console.log('paragraph type:', p.type)
console.log('tokens 数量:', p.tokens ? p.tokens.length : 'NONE')
if (p.tokens) console.log(p.tokens.map(t => t.type + ':' + (t.text||'').slice(0,20)).join(' | '))
console.log('---直接 parse---')
console.log(marked.parse(md).slice(0, 300))
