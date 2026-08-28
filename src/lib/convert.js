// 文档格式转换：Markdown ↔ LaTeX ↔ Typst（基础语法级转换，纯正则）
const T = String.fromCharCode(96)
const F = T + T + T

// ---------- Markdown → LaTeX ----------
export function mdToLatex(md) {
  let s = String(md || '')
  // 代码块先处理（避免被行内规则误伤）
  s = s.replace(new RegExp('^' + F + '(\\w*)\\n([\\s\\S]*?)' + F + '$', 'gm'), function (_m, lang, body) {
    return '\\begin{verbatim}\n' + body.replace(/\n$/, '') + '\n\\end{verbatim}'
  })
  s = s
    .replace(/^###\s+(.+)$/gm, '\\subsubsection*{$1}')
    .replace(/^##\s+(.+)$/gm, '\\subsection*{$1}')
    .replace(/^#\s+(.+)$/gm, '\\section*{$1}')
    // 粗体/斜体一次交替替换，避免互相干扰
    .replace(/\*\*(.+?)\*\*|\*(.+?)\*/g, function (m, a, b) {
      return a ? '\\textbf{' + a + '}' : '\\textit{' + b + '}'
    })
    .replace(/~~([^~]+)~~/g, '\\sout{$1}')
    .replace(/(^|[^\\])`([^`]+)`/g, '$1\\texttt{$2}')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '\\includegraphics{$2}')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '\\href{$2}{$1}')
  // 引用 / 分隔线
  s = s.replace(/^>\s?(.*)$/gm, '\\begin{quote}\n$1\n\\end{quote}')
  s = s.replace(/^---+$/gm, '\\noindent\\rule{\\textwidth}{0.4pt}')
  // 列表
  const lines = s.split('\n')
  let inList = null
  const out = []
  for (const line of lines) {
    const ul = line.match(/^\s*-\s+(.*)$/)
    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ul) {
      if (inList !== 'itemize') {
        if (inList) out.push('\\end{' + inList + '}')
        out.push('\\begin{itemize}')
        inList = 'itemize'
      }
      out.push('  \\item ' + ul[1])
    } else if (ol) {
      if (inList !== 'enumerate') {
        if (inList) out.push('\\end{' + inList + '}')
        out.push('\\begin{enumerate}')
        inList = 'enumerate'
      }
      out.push('  \\item ' + ol[1])
    } else {
      if (inList) { out.push('\\end{' + inList + '}'); inList = null }
      out.push(line)
    }
  }
  if (inList) out.push('\\end{' + inList + '}')
  s = out.join('\n')
  // 表格（基础）
  s = s.replace(/\n((\|[^\n]+\|\n)+)/g, function (_m, block) {
    const rows = block.trim().split('\n').map(function (r) {
      return r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim() })
    }).filter(function (r) { return !/^[-:\s]+$/.test(r.join(' ')) })
    const cols = rows.length ? rows[0].length : 1
    const rowsOut = rows.map(function (r) { return r.join(' & ') + ' \\\\' }).join('\n')
    return '\n\\begin{tabular}{' + 'l'.repeat(cols) + '}\n\\hline\n' + rowsOut + '\n\\hline\n\\end{tabular}\n'
  })
  return s.trim() + '\n'
}

// ---------- Markdown → Typst ----------
export function mdToTypst(md) {
  let s = String(md || '')
  s = s.replace(new RegExp('^' + F + '(\\w*)\\n([\\s\\S]*?)' + F + '$', 'gm'), F + '$1\n$2' + F)
  s = s
    .replace(/^###\s+(.+)$/gm, '=== $1')
    .replace(/^##\s+(.+)$/gm, '== $1')
    .replace(/^#\s+(.+)$/gm, '= $1')
    .replace(/\*\*(.+?)\*\*|\*(.+?)\*/g, function (m, a, b) {
      return a ? '*' + a + '*' : '_' + b + '_'
    })
    .replace(/~~([^~]+)~~/g, '#strike[$1]')
    .replace(/(^|[^\\])`([^`]+)`/g, '$1' + T + '$2' + T)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '#image("$2")')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '#link("$2")[$1]')
  s = s.replace(/^>\s?(.*)$/gm, '#quote[$1]')
  s = s.replace(/^---+$/gm, '#line(length: 100%)')
  return s.trim() + '\n'
}

// ---------- LaTeX → Markdown ----------
export function latexToMd(src) {
  let s = String(src || '')
  s = s
    .replace(/\\textbackslash\{\}/g, '\\')
    .replace(/\\textbf\{([^}]*)\}/g, '**$1**')
    .replace(/\\textit\{([^}]*)\}/g, '*$1*')
    .replace(/\\texttt\{([^}]*)\}/g, T + '$1' + T)
    .replace(/\\sout\{([^}]*)\}/g, '~~$1~~')
    .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '[$2]($1)')
    .replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g, '![]($2)')
    .replace(/\\section\*?\{([^}]*)\}/g, '# $1')
    .replace(/\\subsection\*?\{([^}]*)\}/g, '## $1')
    .replace(/\\subsubsection\*?\{([^}]*)\}/g, '### $1')
    .replace(/\\begin\{itemize\}/g, '')
    .replace(/\\end\{itemize\}/g, '')
    .replace(/\\begin\{enumerate\}/g, '')
    .replace(/\\end\{enumerate\}/g, '')
    .replace(/\\begin\{quote\}/g, '')
    .replace(/\\end\{quote\}/g, '')
    .replace(/\\item\s*/g, '- ')
    .replace(/\\begin\{verbatim\}\n([\s\S]*?)\n\\end\{verbatim\}/g, F + '\n$1\n' + F)
    .replace(/\\begin\{([a-zA-Z*]+)\}/g, '')
    .replace(/\\end\{([a-zA-Z*]+)\}/g, '')
    .replace(/\\hline/g, '')
    .replace(/\\noindent/g, '')
    .replace(/\\rule\{\\textwidth\}\{[^}]*\}/g, '---')
    .replace(/\\([a-zA-Z]+)\{(.*?)\}/g, '$2')
    .replace(/\\([a-zA-Z]+)\b/g, '')
  return s.trim() + '\n'
}

// ---------- Typst → Markdown ----------
export function typstToMd(src) {
  let s = String(src || '')
  s = s
    .replace(/^([=]+)\s*/gm, function (_m, eq) { return '#'.repeat(eq.length) + ' ' })
    .replace(/#strike\[([^\]]*)\]/g, '~~$1~~')
    .replace(/#link\("([^"]*)"\)\[([^\]]*)\]/g, '[$2]($1)')
    .replace(/#image\("([^"]*)"\)/g, '![]($1)')
    .replace(/#quote\[([^\]]*)\]/g, '> $1')
    .replace(/#line\(length: 100%\)/g, '---')
    .replace(/#text\(fill: yellow\)\[([^\]]*)\]/g, '==$1==')
    .replace(/\*([^*\n]+)\*/g, '**$1**')
    .replace(/_([^_\n]+)_/g, '*$1*')
  return s.trim() + '\n'
}

// ---------- 统一转换入口 ----------
export function convertDoc(content, from, to) {
  if (to === 'pdf') return null
  if (from === to) return content
  const md = from === 'md' ? String(content || '') : from === 'latex' ? latexToMd(content) : typstToMd(content)
  if (to === 'md') return md
  if (to === 'latex') return mdToLatex(md)
  if (to === 'typst') return mdToTypst(md)
  return md
}
