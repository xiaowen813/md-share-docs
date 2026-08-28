import { marked } from 'marked'
import '../src/lib/markdownCore.js'
const toks = marked.lexer('**粗体** 和 \`code\` 公式 $x^2$。')
console.log(JSON.stringify(toks, null, 1).slice(0, 1500))
console.log('---lexer level 2---')
console.log(JSON.stringify(toks[0].tokens, null, 1).slice(0, 800))
