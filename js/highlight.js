// Minimal syntax highlighter for code blocks (single-pass tokenizer)
const KEYWORDS = {
  javascript: new Set(['function','const','let','var','return','if','else','for','while','do','switch','case','break','continue','class','extends','import','export','from','default','async','await','new','this','typeof','instanceof','throw','try','catch','finally','yield','of','in','void','delete','super','with','static','get','set','true','false','null','undefined','interface','type','enum','implements','package','private','public','protected','abstract','boolean','number','string','any','unknown','never','readonly','keyof','infer']),
  java: new Set(['public','private','protected','static','final','abstract','class','interface','extends','implements','new','return','if','else','for','while','do','switch','case','break','continue','throw','throws','try','catch','finally','import','package','void','int','long','double','float','boolean','char','byte','short','String','true','false','null','this','super','synchronized','volatile','transient','native','enum','instanceof','default','assert','var','record','sealed','permits']),
  python: new Set(['def','class','import','from','return','if','elif','else','for','while','with','as','try','except','finally','raise','pass','yield','lambda','and','or','not','is','in','del','global','nonlocal','assert','break','continue','async','await','True','False','None','self','print','open','len','range']),
  rust: new Set(['fn','let','mut','const','static','struct','enum','impl','trait','pub','use','mod','crate','self','super','where','for','in','if','else','match','while','loop','break','continue','return','move','ref','async','await','as','dyn','type','unsafe','extern','true','false','Some','None','Ok','Err','Box','Vec','String','Option','Result','panic']),
  solidity: new Set(['contract','function','public','private','internal','external','view','pure','payable','returns','address','uint','uint256','bool','string','bytes','mapping','struct','enum','event','emit','modifier','require','revert','assert','memory','storage','calldata','indexed','constructor','fallback','receive','virtual','override','new','delete','this','msg','block','tx','now','true','false','import','pragma','solidity','is','using','for','if','else','while','do','return','break','continue','library','interface','abstract']),
  csharp: new Set(['public','private','protected','internal','static','class','struct','interface','enum','record','var','string','int','long','double','float','bool','char','decimal','void','null','true','false','new','return','if','else','for','foreach','in','while','do','switch','case','break','continue','try','catch','finally','throw','using','namespace','async','await','virtual','override','abstract','sealed','partial','readonly','const','ref','out','get','set','value','this','base','is','as','typeof','nameof','where','select','from','let','yield','Task','List','Dictionary']),
  yaml: new Set(['true','false','null','yes','no','on','off']),
  dockerfile: new Set(['FROM','RUN','CMD','EXPOSE','ENV','COPY','ADD','WORKDIR','ENTRYPOINT','VOLUME','USER','ARG','LABEL','ONBUILD','STOPSIGNAL','HEALTHCHECK','SHELL','MAINTAINER']),
  shell: new Set(['echo','cd','ls','mkdir','rm','cp','mv','cat','grep','sed','awk','find','chmod','chown','sudo','apt','npm','yarn','pip','git','docker','curl','wget','export','source','alias','ps','kill','top','df','du','tar','gzip','ssh','scp','chown','ln','head','tail','sort','uniq','wc','tee','env','unset','declare','if','then','else','elif','fi','for','done','case','esac','function','local','readonly','trap']),
  sql: new Set(['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','ALTER','DROP','INDEX','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AND','OR','NOT','NULL','IS','IN','LIKE','BETWEEN','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','UNION','ALL','AS','DISTINCT','COUNT','SUM','AVG','MAX','MIN','EXISTS','CASE','WHEN','THEN','ELSE','END','PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','UNIQUE','CHECK','VARCHAR','INT','BIGINT','TEXT','BOOLEAN','TIMESTAMP','CASCADE']),
};

const ALIASES = {
  js: 'javascript', ts: 'javascript', typescript: 'javascript',
  py: 'python', python3: 'python',
  sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell',
  java: 'java',
  rs: 'rust', rust: 'rust',
  sol: 'solidity', solidity: 'solidity',
  cs: 'csharp', 'c#': 'csharp', csharp: 'csharp', dotnet: 'csharp',
  yml: 'yaml', yaml: 'yaml',
  dockerfile: 'dockerfile', docker: 'dockerfile',
  sql: 'sql',
  move: 'solidity',  // Sui Move maps to solidity keywords as closest match
  c: 'javascript',  // fallback for C-like code
  cpp: 'javascript', 'c++': 'javascript',
};

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unescapeHtml(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function wrap(cls, text) {
  return `<span class="${cls}">${text}</span>`;
}

function tokenize(code, lang) {
  const resolved = ALIASES[lang] || lang;
  const kws = KEYWORDS[resolved];
  const isHashComment = resolved === 'python' || resolved === 'shell' || resolved === 'yaml' || resolved === 'dockerfile' || resolved === 'sql';
  const isCStyle = !isHashComment && resolved !== 'html';

  const tokens = [];
  let i = 0;

  while (i < code.length) {
    // HTML comments
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4);
      const endIdx = end === -1 ? code.length : end + 3;
      tokens.push({ type: 'comment', text: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }

    // Hash comments (#) - Python, Shell, YAML, Dockerfile, SQL
    if (isHashComment && code[i] === '#') {
      const end = code.indexOf('\n', i);
      const endIdx = end === -1 ? code.length : end;
      tokens.push({ type: 'comment', text: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }

    // C-style single-line comments //
    if (isCStyle && code[i] === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      const endIdx = end === -1 ? code.length : end;
      tokens.push({ type: 'comment', text: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }

    // C-style multi-line comments
    if (isCStyle && code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const endIdx = end === -1 ? code.length : end + 2;
      tokens.push({ type: 'comment', text: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }

    // Strings (single/double quote)
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++;
        j++;
      }
      j++; // include closing quote
      tokens.push({ type: 'string', text: code.slice(i, j) });
      i = j;
      continue;
    }

    // Template literals
    if (code[i] === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== '`') {
        if (code[j] === '\\') j++;
        j++;
      }
      j++;
      tokens.push({ type: 'string', text: code.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(code[i]) && (i === 0 || !/\w/.test(code[i - 1]))) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: 'number', text: code.slice(i, j) });
      i = j;
      continue;
    }

    // Keywords / identifiers
    if (/[a-zA-Z_$@#]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w$@#-]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (kws && kws.has(word)) {
        tokens.push({ type: 'keyword', text: word });
      } else {
        tokens.push({ type: 'plain', text: word });
      }
      i = j;
      continue;
    }

    // Other characters
    tokens.push({ type: 'plain', text: code[i] });
    i++;
  }

  return tokens;
}

function highlightBlock(codeHtml, lang) {
  const raw = unescapeHtml(codeHtml);
  const tokens = tokenize(raw, lang);
  return tokens.map(({ type, text }) => {
    const esc = escapeHtml(text);
    if (type === 'comment') return wrap('hl-comment', esc);
    if (type === 'string') return wrap('hl-string', esc);
    if (type === 'number') return wrap('hl-number', esc);
    if (type === 'keyword') return wrap('hl-keyword', esc);
    return esc;
  }).join('');
}

function highlightCode(html) {
  return html.replace(/<code( class="language-(\w+)")?>([\s\S]*?)<\/code>/g, (match, attr, lang, code) => {
    if (!lang) return match;
    const highlighted = highlightBlock(code, lang);
    return `<code class="language-${lang}">${highlighted}</code>`;
  });
}

export { highlightCode };
