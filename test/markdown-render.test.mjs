import { JSDOM } from 'jsdom'
import { renderMarkdown } from '../src/lib/markdownCore.js'

// Node 环境需要 window 给 DOMPurify
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document

const cases = {
  '标题': '# 标题一\n\n## 标题二',
  '加粗/斜体/删除线': '**粗体** *斜体* ~~删除线~~',
  '行内代码': '代码 `const a = 1` 结束',
  '代码块(带语言)': '```js\nconst x = 1;\nconsole.log(x)\n```',
  '链接': '[百度](https://www.baidu.com)',
  '图片': '![logo](https://example.com/a.png)',
  '自动链接': '访问 https://www.baidu.com 吧',
  '无序列表': '- 苹果\n- 香蕉\n  - 子项',
  '有序列表': '1. 第一\n2. 第二',
  '任务列表': '- [x] 已完成\n- [ ] 未完成',
  '引用': '> 这是一段引用\n> 第二行',
  '嵌套引用': '> 外层\n> > 内层',
  '表格': '| 列A | 列B |\n| --- | --- |\n| 1 | 2 |',
  '水平线': '---',
  '行内公式': '条件：$-r\\le low\\le high\\le r$',
  '块级公式': '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
  '脚注': '这里是正文[^1]\n\n[^1]: 这是脚注内容',
  '定义列表': '术语\n: 定义内容',
  '上下标(pandoc)': 'H~2~O 和 x^2^',
  '高亮(==)': '这是 ==重点内容==',
  '内嵌HTML mark': '这是 <mark>高亮</mark> 文字',
  '内嵌HTML sub/sup': 'H<sub>2</sub>O 和 x<sup>2</sup>',
  '内嵌HTML kbd': '按 <kbd>Ctrl</kbd> + <kbd>S</kbd>',
  '内嵌HTML details': '<details><summary>点击展开</summary>隐藏内容</details>',
  '内嵌HTML center': '<center>居中文字</center>',
  'emoji简码': '开心 :smile: 难过',
  'TOC': '[TOC]',
  '换行/空格': '第一行  \n第二行',
  '特殊字符转义': '\\*不是斜体\\* 和 < & >',
}

for (const [name, md] of Object.entries(cases)) {
  const html = renderMarkdown(md)
  console.log('==========', name, '==========')
  console.log(html)
  console.log('')
}
