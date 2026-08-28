// 文档格式转换：Markdown ↔ LaTeX ↔ Typst（token 级转换，正确转义特殊字符）
import { marked } from 'marked'
import './markdownCore.js' // 副作用：注册公式/高亮等 marked 扩展，保证转换时语法完整

const T = String.fromCharCode(96)
const F = T + T + T

// ---------- 转义 ----------
// marked 的 text token 会把 & < > " 转成实体，先还原再转义目标格式
function unescapeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}
function escL(s) {
  return unescapeHtml(s)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}&#%_~^$])/g, '\\$1')
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
    case 'text': {
      // marked 的 text token 同时含 text 和已解析的 tokens，二者重叠；
      // 有 tokens 时只渲染 tokens，避免内容重复
      if (node.tokens && node.tokens.length) return node.tokens.map(inlL).join('')
      return escL(node.text || '')
    }
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
      const lvl = t.depth <= 1 ? 'section' : t.depth === 2 ? 'subsection' : 'subsubsection'
      return '\\' + lvl + '*{' + (t.tokens || []).map(inlL).join('') + '}\n\n'
    }
    case 'paragraph': return (t.tokens || []).map(inlL).join('') + '\n\n'
    case 'code': return '\\begin{verbatim}\n' + (t.text || '') + '\n\\end{verbatim}\n\n'
    case 'blockquote': return '\\begin{quote}\n' + (t.tokens || []).map(inlL).join('') + '\n\\end{quote}\n\n'
    case 'list': {
      const env = t.ordered ? 'enumerate' : 'itemize'
      const items = t.items.map(function (it) { return '  \\item ' + blockChildrenL(it) }).join('\n')
      return '\\begin{' + env + '}\n' + items + '\n\\end{' + env + '}\n\n'
    }
    case 'table': {
      const cols = 'l'.repeat(t.header.length)
      const rows = [t.header].concat(t.rows).map(function (r) {
        return r.map(function (c) { return (c.tokens || []).map(inlL).join('') }).join(' & ') + ' \\\\'
      }).join('\n')
      return '\\begin{tabular}{' + cols + '}\n\\hline\n' + rows + '\n\\hline\n\\end{tabular}\n\n'
    }
    case 'hr': return '\\noindent\\rule{\\textwidth}{0.4pt}\n\n'
    case 'blockMath': return '$' + t.text + '$\n\n'
    case 'mermaidBlock': return '\\begin{verbatim}\n' + t.text + '\n\\end{verbatim}\n\n'
    case 'defList': return '\\textbf{' + escL(t.dt) + '}：' + t.dds.map(escL).join('；') + '\n\n'
    case 'footnoteDef': return ''
    case 'space': return ''
    case 'html': return (t.text || '') + '\n\n'
    default: return (t.text || '') + '\n\n'
  }
}

export function mdToLatex(md) {
  return marked.lexer(md || '').map(blkL).join('').trim() + '\n'
}

// ========== Markdown → Typst ==========
function inlT(node) {
  if (typeof node === 'string') return escT(node)
  const kids = function () {
    return node.tokens ? node.tokens.map(inlT).join('') : escT(node.text || '')
  }
  switch (node.type) {
    case 'text': {
      if (node.tokens && node.tokens.length) return node.tokens.map(inlT).join('')
      return escT(node.text || '')
    }
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
