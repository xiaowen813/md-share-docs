// 文档格式转换：Markdown ↔ LaTeX ↔ Typst（token 级转换）
// LaTeX 输出适配「竞赛/讲义模板」风格：chapter/section、definition/theorem 环境、
// lstlisting 代码块、booktabs 表格、保留预定义命令（\N \abs \OO 等）
import { marked } from 'marked'
import './markdownCore.js' // 注册公式/高亮等 marked 扩展

const T = String.fromCharCode(96)
const F = T + T + T

// ---------- 转义 ----------
function unescapeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

// LaTeX 文本转义：保留 LaTeX 命令（\abs{-x}、\OO(n\log n)）与控制符号（\\ \[ \{），
// 其他特殊字符转义
function escL(s) {
  s = unescapeHtml(s)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') {
      const m = s.slice(i).match(/^\\([a-zA-Z]+)/)
      if (m) {
        let j = i + m[0].length
        // 吸收命令后紧跟的 {…} 参数（支持嵌套一层）
        if (s[j] === '{') {
          let depth = 0
          let k = j
          while (k < s.length) {
            if (s[k] === '{') depth++
            else if (s[k] === '}') { depth--; if (depth === 0) break }
            k++
          }
          j = k + 1
        }
        out += s.slice(i, j)
        i = j - 1
        continue
      }
      const next = s[i + 1]
      if (next && /[\\[{]/.test(next)) {
        out += ch + next
        i++
        continue
      }
      out += '\\textbackslash{}'
      continue
    }
    if (/([{}&#%_~^$])/.test(ch)) {
      out += '\\' + ch
      continue
    }
    out += ch
  }
  return out
}
function escUrl(s) {
  return unescapeHtml(s).replace(/\\/g, '\\textbackslash{}').replace(/([{}%&_])/g, '\\$1')
}
function escT(s) {
  return unescapeHtml(s).replace(/[\\*_$]/g, function (c) { return '\\' + c })
}

// ========== Markdown → LaTeX ==========
function inlL(node) {
  if (typeof node === 'string') return escL(node)
  const kids = function () {
    return node.tokens ? node.tokens.map(inlL).join('') : escL(node.text || '')
  }
  switch (node.type) {
    case 'text':
      if (node.tokens && node.tokens.length) return node.tokens.map(inlL).join('')
      return escL(node.text || '')
    case 'strong': return '\\textbf{' + kids() + '}'
    case 'em': return '\\textit{' + kids() + '}'
    case 'del': return '\\sout{' + kids() + '}'
    case 'codespan': return '\\texttt{' + escL(node.text || '') + '}'
    case 'link': return '\\href{' + escUrl(node.href) + '}{' + kids() + '}'
    case 'image': return '\\includegraphics{' + escUrl(node.href) + '}'
    case 'inlineMath': return node.text ? '$' + node.text + '$' : ''
    case 'highlightText': return '\\hl{' + kids() + '}'
    case 'superscript': return '\\textsuperscript{' + kids() + '}'
    case 'subscript': return '\\textsubscript{' + kids() + '}'
    case 'emoji': return node.emoji || ''
    case 'footnoteRef': return '\\footnote{' + escL(node.id) + '}'
    case 'br': return '\\\\'
    default: return escL(node.text || '')
  }
}

function blockChildrenL(t) {
  if (!t.tokens) return ''
  return t.tokens.map(function (n) {
    return n.type === 'list' || n.type === 'paragraph' || n.type === 'space' || n.type === 'blockquote' ? blkL(n) : inlL(n)
  }).join('')
}

function blkL(t) {
  switch (t.type) {
    case 'heading': {
      // 适配讲义模板：# → \chapter，## → \section，### → \subsection
      const cmd = t.depth === 1 ? 'chapter' : t.depth === 2 ? 'section' : t.depth === 3 ? 'subsection' : 'subsubsection'
      return '\\' + cmd + '{' + (t.tokens || []).map(inlL).join('') + '}\n\n'
    }
    case 'paragraph': return (t.tokens || []).map(inlL).join('') + '\n\n'
    case 'code': return '\\begin{lstlisting}\n' + (t.text || '') + '\n\\end{lstlisting}\n\n'
    case 'blockquote': return '\\begin{quote}\n' + (t.tokens || []).map(inlL).join('') + '\n\\end{quote}\n\n'
    case 'list': {
      const env = t.ordered ? 'enumerate' : 'itemize'
      const items = t.items.map(function (it) { return '  \\item ' + blockChildrenL(it) }).join('\n')
      return '\\begin{' + env + '}\n' + items + '\n\\end{' + env + '}\n\n'
    }
    case 'table': {
      // booktabs 风格表格
      const cols = 'l'.repeat(t.header.length)
      const header = t.header.map(function (c) { return (c.tokens || []).map(inlL).join('') }).join(' & ') + ' \\\\'
      const rows = t.rows.map(function (r) {
        return r.map(function (c) { return (c.tokens || []).map(inlL).join('') }).join(' & ') + ' \\\\'
      }).join('\n')
      return '\\begin{table}[h]\n\\centering\n\\begin{tabular}{' + cols + '}\n\\toprule\n' + header + '\n\\midrule\n' + rows + '\n\\bottomrule\n\\end{tabular}\n\\end{table}\n\n'
    }
    case 'hr': return '\\noindent\\rule{\\textwidth}{0.4pt}\n\n'
    case 'blockMath': return '$' + t.text + '$\n\n'
    case 'mermaidBlock': return '\\begin{lstlisting}\n' + t.text + '\n\\end{lstlisting}\n\n'
    case 'defList': return '\\textbf{' + escL(t.dt) + '}：' + t.dds.map(escL).join('；') + '\n\n'
    case 'footnoteDef': return ''
    case 'space': return ''
    case 'html': return (t.text || '') + '\n\n'
    default: return (t.text || '') + '\n\n'
  }
}

export function mdToLatex(md) {
  let s = String(md || '')
  const envs = []
  const save = function (tex) {
    envs.push(tex)
    return '\n@@LATEXENV' + (envs.length - 1) + '@@\n'
  }
  // 0) 已有 LaTeX 环境直通（definition / theorem / example 等，原样保留）
  s = s.replace(/\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}/g, function (m) { return save(m) })
  // 1) display math \[ … \] 原样保留
  s = s.replace(/\\\[[\s\S]*?\\\]/g, function (m) { return save(m) })
  // 2) ::: 环境语法（::: definition [标题] … :::）→ \begin{definition}[标题]…\end{definition}
  s = s.replace(/^:::\s*([a-zA-Z*]+)(?:\s*\[([^\]]*)\])?\s*\n([\s\S]*?)^:::\s*$/gm, function (_m, env, title, body) {
    return save('\\begin{' + env + '}' + (title ? '[' + title + ']' : '') + '\n    ' + body.trim() + '\n\\end{' + env + '}')
  })
  // 3) 代码块 → lstlisting
  s = s.replace(new RegExp('^' + F + '(\\w*)\\n([\\s\\S]*?)' + F + '$', 'gm'), function (_m, lang, body) {
    return save('\\begin{lstlisting}\n' + body.replace(/\n$/, '') + '\n\\end{lstlisting}')
  })
  // 4) 其余 md 走 token 转换
  let out = marked.lexer(s).map(blkL).join('').trim()
  // 5) 还原直通片段（循环替换，支持嵌套占位符）
  let guard = 0
  while (out.indexOf('@@LATEXENV') !== -1 && guard++ < 50) {
    out = out.replace(/@@LATEXENV(\d+)@@/g, function (_m, i) { return envs[+i] || '' })
  }
  return out + '\n'
}

// ========== Markdown → Typst ==========
function inlT(node) {
  if (typeof node === 'string') return escT(node)
  const kids = function () {
    return node.tokens ? node.tokens.map(inlT).join('') : escT(node.text || '')
  }
  switch (node.type) {
    case 'text':
      if (node.tokens && node.tokens.length) return node.tokens.map(inlT).join('')
      return escT(node.text || '')
    case 'strong': return '*' + kids() + '*'
    case 'em': return '_' + kids() + '_'
    case 'del': return '#strike[' + kids() + ']'
    case 'codespan': return T + (node.text || '') + T
    case 'link': return '#link("' + node.href + '")[' + kids() + ']'
    case 'image': return '#image("' + node.href + '")'
    case 'inlineMath': return node.text ? '$' + node.text + '$' : ''
    case 'highlightText': return '#text(fill: yellow)[' + kids() + ']'
    case 'superscript': return '^' + kids() + '^'
    case 'subscript': return '~' + kids() + '~'
    case 'emoji': return node.emoji || ''
    case 'footnoteRef': return '(脚注:' + node.id + ')'
    case 'br': return '\\'
    default: return escT(node.text || '')
  }
}

function blockChildrenT(t) {
  if (!t.tokens) return ''
  return t.tokens.map(function (n) {
    return n.type === 'list' || n.type === 'paragraph' || n.type === 'space' || n.type === 'blockquote' ? blkT(n) : inlT(n)
  }).join('')
}

function blkT(t) {
  switch (t.type) {
    case 'heading':
      return '='.repeat(Math.min(t.depth, 6)) + ' ' + (t.tokens || []).map(inlT).join('') + '\n\n'
    case 'paragraph': return (t.tokens || []).map(inlT).join('') + '\n\n'
    case 'code': return F + (t.lang || '') + '\n' + t.text + '\n' + F + '\n\n'
    case 'blockquote': return '#quote[' + (t.tokens || []).map(inlT).join('') + ']\n\n'
    case 'list':
      return t.items.map(function (it, i) {
        const prefix = t.ordered ? String(i + 1) + '. ' : '- '
        return prefix + blockChildrenT(it)
      }).join('\n') + '\n\n'
    case 'table':
      return [t.header].concat(t.rows).map(function (r) {
        return '| ' + r.map(function (c) { return (c.tokens || []).map(inlT).join('') }).join(' | ') + ' |'
      }).join('\n') + '\n\n'
    case 'hr': return '#line(length: 100%)\n\n'
    case 'blockMath': return '$$\n' + t.text + '\n$$\n\n'
    case 'mermaidBlock': return F + '\n' + t.text + '\n' + F + '\n\n'
    case 'defList': return '*' + t.dt + '*: ' + t.dds.join('; ') + '\n\n'
    case 'footnoteDef': return ''
    case 'space': return ''
    case 'html': return (t.text || '') + '\n\n'
    default: return (t.text || '') + '\n\n'
  }
}

export function mdToTypst(md) {
  return marked.lexer(md || '').map(blkT).join('').trim() + '\n'
}

// ========== LaTeX → Markdown ==========
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
    .replace(/\\chapter\*?\{([^}]*)\}/g, '# $1')
    .replace(/\\section\*?\{([^}]*)\}/g, '## $1')
    .replace(/\\subsection\*?\{([^}]*)\}/g, '### $1')
    .replace(/\\subsubsection\*?\{([^}]*)\}/g, '#### $1')
    .replace(/\\begin\{itemize\}/g, '')
    .replace(/\\end\{itemize\}/g, '')
    .replace(/\\begin\{enumerate\}/g, '')
    .replace(/\\end\{enumerate\}/g, '')
    .replace(/\\begin\{quote\}/g, '')
    .replace(/\\end\{quote\}/g, '')
    .replace(/\\item\s*/g, '- ')
    .replace(/\\begin\{lstlisting\}\n([\s\S]*?)\n\\end\{lstlisting\}/g, F + '\n$1\n' + F)
    .replace(/\\begin\{verbatim\}\n([\s\S]*?)\n\\end\{verbatim\}/g, F + '\n$1\n' + F)
    .replace(/\\begin\{([a-zA-Z*]+)\}/g, '')
    .replace(/\\end\{([a-zA-Z*]+)\}/g, '')
    .replace(/\\toprule/g, '')
    .replace(/\\midrule/g, '')
    .replace(/\\bottomrule/g, '')
    .replace(/\\hline/g, '')
    .replace(/\\noindent/g, '')
    .replace(/\\centering/g, '')
    .replace(/\\rule\{\\textwidth\}\{[^}]*\}/g, '---')
    .replace(/\\([a-zA-Z]+)\{(.*?)\}/g, '$2')
    .replace(/\\([a-zA-Z]+)\b/g, '')
  return s.trim() + '\n'
}

// ========== Typst → Markdown ==========
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

// ========== 统一转换入口 ==========
export function convertDoc(content, from, to) {
  if (to === 'pdf') return null
  if (from === to) return content
  const md = from === 'md' ? String(content || '') : from === 'latex' ? latexToMd(content) : typstToMd(content)
  if (to === 'md') return md
  if (to === 'latex') return mdToLatex(md)
  if (to === 'typst') return mdToTypst(md)
  return md
}
