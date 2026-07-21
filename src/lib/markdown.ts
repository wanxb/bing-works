import { marked, type Tokens } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

export interface Heading {
  level: number;
  id: string;
  text: string;
}

marked.use(markedHighlight({
  emptyLangClass: 'hljs',
  langPrefix: 'hljs language-',
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  },
}));

function stripInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slugify(value: string) {
  return stripInlineMarkdown(value)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function collectHeadings(markdown: string): Heading[] {
  const seen = new Map<string, number>();

  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{2,3})\s+(.+?)\s*#*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const text = stripInlineMarkdown(match[2]);
      const baseId = slugify(text);
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);
      return {
        level: match[1].length,
        id: count ? `${baseId}-${count + 1}` : baseId,
        text,
      };
    });
}

function normalizeArticleMarkdown(markdown: string) {
  return markdown
    .replace(/^#\s+.+?\r?\n+/, '')
    .replace(/\]\((?:\.\/)?posts\/images\//g, '](/posts/images/')
    .replace(/\]\(\.\/images\//g, '](/posts/images/');
}

export function renderMarkdown(markdown: string) {
  const normalized = normalizeArticleMarkdown(markdown);
  const headings = collectHeadings(normalized);
  let headingIndex = 0;
  const renderer = new marked.Renderer();

  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    const content = this.parser.parseInline(tokens);
    if (depth !== 2 && depth !== 3) {
      return `<h${depth}>${content}</h${depth}>\n`;
    }

    const heading = headings[headingIndex++];
    const id = heading?.id || `section-${headingIndex}`;
    return `<h${depth} id="${id}">${content}</h${depth}>\n`;
  };

  const html = marked.parse(normalized, {
    gfm: true,
    breaks: false,
    renderer,
  }) as string;

  return { html, headings };
}
