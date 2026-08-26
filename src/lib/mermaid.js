let mermaidPromise = null

// 渲染 DOM 内所有未处理的 .mermaid 元素（mermaid 按需动态加载，不拖慢首屏）
export function renderMermaidElements(root = document) {
  const els = Array.from(root.querySelectorAll('.mermaid:not([data-processed])'))
  if (!els.length) return Promise.resolve()
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' })
      return mermaid
    })
  }
  return mermaidPromise.then(async (mermaid) => {
    for (const el of els) {
      el.setAttribute('data-processed', 'true')
      try {
        const { svg } = await mermaid.render('mermaid-' + Math.random().toString(36).slice(2, 10), el.textContent || '')
        el.innerHTML = svg
      } catch (e) {
        el.innerHTML = `<p class="mermaid-error">Mermaid 渲染失败：${e.message}</p>`
      }
    }
  })
}
