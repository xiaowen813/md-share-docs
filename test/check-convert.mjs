import { mdToLatex, mdToTypst, latexToMd, typstToMd } from '../src/lib/convert.js'

const md = '# 标题\n\n这是 **粗体** 和 *斜体*，公式 $a^2$。\n\n- 项目一\n- 项目二\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n'
console.log('=== md → latex ===')
console.log(mdToLatex(md).slice(0, 300))
console.log('=== md → typst ===')
console.log(mdToTypst(md).slice(0, 250))
const tex = '\\section*{章节}\n\n这是 \\textbf{重点}。\n\\begin{itemize}\n\\item 甲\n\\item 乙\n\\end{itemize}'
console.log('=== latex → md ===')
console.log(latexToMd(tex))
