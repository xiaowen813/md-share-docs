import * as emojiMod from 'markdown-it-emoji'
console.log('keys:', Object.keys(emojiMod))
const full = emojiMod.full || emojiMod.default?.full
console.log('full 条目数:', full ? Object.keys(full).length : 'N/A')
console.log('sample:', full ? JSON.stringify({ smile: full.smile, heart: full.heart, plus1: full.plus1 }) : 'none')
