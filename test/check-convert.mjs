import '../src/lib/markdownCore.js'
import { mdToLatex, mdToTypst, latexToMd } from '../src/lib/convert.js'

const md = '# 标题 & 百分% 井#号\n\n正文含 & % # _ ~ ^ $ { } 和 **粗体** 与 *斜体*，行内代码 \`a_b#c\`，公式 $x^2$。\n\n- 项目一 & 二\n- **嵌套** 粗体\n\n\`\`\`js\nconst x = a_b;\n  const indented = 1;\n\`\`\`\n\n| 列A | 列B |\n| --- | --- |\n| 1 | 2 |\n\n[链接](https://example.com/a_b?x=1&y=2)\n'
console.log('=== md → latex ===')
console.log(mdToLatex(md))
console.log('=== md → typst ===')
console.log(mdToTypst(md).slice(0, 600))
