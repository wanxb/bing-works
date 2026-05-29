// Zero-dependency Markdown parser
function slugify(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w一-鿿]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseInline(text) {
  // images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');
  // strikethrough
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const headings = [];
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const codeMatch = line.match(/^```(\w*)/);
    if (codeMatch) {
      const lang = codeMatch[1];
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      const langAttr = lang ? ` class="language-${lang}"` : '';
      html += `<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>\n`;
      continue;
    }

    // headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/[#]+$/, '').trim();
      const id = slugify(text);
      headings.push({ level, id, text });
      html += `<h${level} id="${id}">${parseInline(text)}</h${level}>\n`;
      i++;
      continue;
    }

    // horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr />\n';
      i++;
      continue;
    }

    // table
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?\s*$/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      const alignLine = lines[i + 1];
      const aligns = alignLine.split('|').map(c => c.trim()).filter(Boolean).map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      html += '<table><thead><tr>';
      headerCells.forEach((cell, ci) => {
        const align = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : '';
        html += `<th${align}>${parseInline(cell)}</th>`;
      });
      html += '</tr></thead><tbody>\n';
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        html += '<tr>';
        cells.forEach((cell, ci) => {
          const align = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : '';
          html += `<td${align}>${parseInline(cell)}</td>`;
        });
        html += '</tr>\n';
        i++;
      }
      html += '</tbody></table>\n';
      continue;
    }

    // blockquote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      html += `<blockquote>${parseInline(quoteLines.join(' '))}</blockquote>\n`;
      continue;
    }

    // unordered list
    if (/^(\s*)([-*])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*)([-*])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      html += '<ul>' + items.map(item => `<li>${parseInline(item)}</li>`).join('') + '</ul>\n';
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      html += '<ol>' + items.map(item => `<li>${parseInline(item)}</li>`).join('') + '</ol>\n';
      continue;
    }

    // empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^(#{1,6}\s|```|> |[-*]\s|\d+\.\s|(\*{3,}|-{3,}|_{3,})\s*$)/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      html += `<p>${parseInline(paraLines.join(' '))}</p>\n`;
    }
  }

  return { html, headings };
}

export { parseMarkdown };
