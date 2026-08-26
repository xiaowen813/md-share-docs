import { JSDOM } from 'jsdom'
import { renderMarkdown } from '../src/lib/markdownCore.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const cases = {
  '脚注': '这里是正文[^1]和引用[^note]\n\n[^1]: 第一条脚注内容\n[^note]: 第二条脚注\n  换行内容',
  '定义列表': '术语一\n: 定义内容甲\n: 定义内容乙\n\n**粗体术语**\n: 定义乙',
  'emoji': '开心 :smile: 点赞 :+1: 爱心 :heart: 无效 :not_a_real_emoji_xyz:',
  '下标/上标': 'H~2~O 和 x^2^ 删除线 ~~删除~~',
  'TOC': '# 第一章\n## 第一节\n### 细节\n\n[TOC]\n\n# 第二章',
  'Mermaid': '```mermaid\ngraph TD\n    A[开始] --> B[处理]\n    B --> C[结束]\n```',
  '数学公式': '条件 $-r\\le low\\le high\\le r$，公式 $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$',
}

for (const [name, md] of Object.entries(cases)) {
  const html = renderMarkdown(md)
  console.log('==========', name, '==========')
  console.log(html.slice(0, 800))
  console.log('')
}
