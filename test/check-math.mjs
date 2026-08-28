import '../src/lib/markdownCore.js'
import { mdToLatex, latexToMd } from '../src/lib/convert.js'

const md = '# 测试\n\n行内 $a \\mid b$，块级\n\n$$ \\frac{1}{2} \\equiv x \\pmod{p} $$\n'
console.log('=== md → latex ===')
console.log(mdToLatex(md))
const tex = '## 章节\n\n公式 $a \\mid b$ 和 $$\\frac{1}{2} \\pmod{p}$$，独立公式 \\[ x^2 \\equiv 1 \\]\n'
console.log('=== latex → md ===')
console.log(latexToMd(tex))
