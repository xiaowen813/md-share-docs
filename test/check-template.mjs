import '../src/lib/markdownCore.js'
import { mdToLatex, latexToMd } from '../src/lib/convert.js'

const md = '# 示例章节\n\n本章演示数学定理、复杂度记号与代码块。\n\n## 数学环境\n\n::: definition [同余]\n若 $m \\mid (a - b)$，则称 $a$ 与 $b$ 模 $m$ 同余，记作 $a \\equiv b \\pmod{m}$。\n:::\n\n::: theorem [费马小定理]\n设 $p$ 为素数，$a$ 为整数且 $p \\nmid a$，则\n\\[ a^{p-1} \\equiv 1 \\pmod{p}. \\]\n:::\n\n预定义命令：$\\N, \\Z, \\Q, \\R$，$\\abs{-x} = x$，复杂度 $\\OO(n \\log n)$。\n\n## 代码环境\n\n\`\`\`cpp\nlong long qpow(long long a, long long b, long long mod) {\n    long long res = 1;\n    return res;\n}\n\`\`\`\n\n## 表格\n\n| 数据结构 | 查询 | 修改 |\n| --- | --- | --- |\n| 树状数组 | $\\OO(\\log n)$ | $\\OO(\\log n)$ |\n| 分块 | $\\OO(\\sqrt{n})$ | $\\OO(1)$ |\n'
console.log(mdToLatex(md))
