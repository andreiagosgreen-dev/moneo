/**
 * The small Markdown subset the guides use, rendered to HTML:
 * `## h2`, `### h3`, `- list`, `1. list`, `> tip`, paragraphs (blank-line
 * separated), `**bold**` and `[text](/path)`. Everything is escaped first, so
 * guide text can never inject markup; links must be site paths or https.
 */

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

export function renderMarkdown(src: string): string {
  const blocks = src
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      if (block.startsWith('### ')) return `<h3>${inline(block.slice(4))}</h3>`;
      if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`;
      if (lines.every((l) => l.startsWith('- '))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`;
      }
      if (lines.every((l) => l.startsWith('> '))) {
        return `<aside class="g-tip">${inline(lines.map((l) => l.slice(2)).join(' '))}</aside>`;
      }
      return `<p>${inline(lines.join(' '))}</p>`;
    })
    .join('\n');
}

/** Plain text of a mini-markdown body (for word counts). */
export function plainText(src: string): string {
  return src
    .replace(/^(#{2,3}|-|\d+\.|>)\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}
