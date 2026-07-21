import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const thumbsDir = join(root, 'assets', 'thumbs');

const works = [
  ['moto-agent', '弼马温', 'Moto Agent', 'moto', '#39A0FF', '#5EEAD4'],
  ['token-usage-dashboard', 'Token 用量面板', 'Usage Dashboard', 'tokens', '#4F46E5', '#22D3EE'],
  ['issuepilot', 'IssuePilot', 'Multi-Agent Workflow', 'workflow', '#F97316', '#22C55E'],
  ['ai-news', 'AI 资讯', 'AI News Timeline', 'news', '#2563EB', '#F59E0B'],
  ['luminote', 'Luminote', 'Photography Portfolio', 'camera', '#EC4899', '#38BDF8'],
  ['screen-time', '屏幕时间', 'Screen Time', 'screen', '#10B981', '#60A5FA'],
  ['mortgage-advisor', '房贷参谋', 'Mortgage Advisor', 'mortgage', '#0EA5E9', '#84CC16'],
  ['c-drive-cleaner', 'C 盘清理器', 'C Drive Cleaner', 'cleaner', '#64748B', '#06B6D4'],
  ['alpha-radar', 'AlphaRadar', 'Alpha Event Radar', 'radar', '#22C55E', '#38BDF8'],
  ['ai-chat-slice', 'AI 聊天切片', 'AIChatSlice', 'chat', '#8B5CF6', '#06B6D4'],
  ['time-clock', '极简时钟', 'Time Clock', 'clock', '#111827', '#F97316'],
  ['chinese-emperors-timeline', '皇帝年表', 'Timeline', 'timeline', '#B45309', '#DC2626'],
  ['china-map-puzzle', '地图拼块', 'China Map Puzzle', 'map', '#059669', '#F59E0B'],
  ['cyber-ocean', '赛博海洋', 'Cyber Ocean', 'ocean', '#06B6D4', '#A855F7'],
  ['eye-spa-pro', '护眼空间', 'Eye Spa Pro', 'eye', '#14B8A6', '#84CC16'],
  ['park-timer-bot', '停车计时机器人', 'ParkTimerBot', 'parking', '#3B82F6', '#F59E0B'],
  ['clip-box', 'ClipBox', 'Clipboard Manager', 'clipboard', '#6366F1', '#22C55E'],
  ['beat-cli', 'BeatCLI', 'CLI Music Player', 'music', '#F43F5E', '#FBBF24'],
  ['spoon-force', 'SpoonForce', 'Kitchen Scale', 'scale', '#0F766E', '#F97316'],
  ['letters-longing', '尺素', '书信美学资料库', 'letters', '#7C3AED', '#D97706'],
  ['tech-vocab-trainer', '技术词汇训练', 'Tech Vocab Trainer', 'vocab', '#2563EB', '#22C55E'],
  ['shuangshoujian', '双手剑', '自学教学网站', 'swords', '#92400E', '#CBD5E1'],
  ['memory-garden', '记忆花园', 'Digital Memory Landscape', 'memory', '#16A34A', '#A855F7'],
  ['zen-stones', '禅石排布', 'Calm Interaction', 'stones', '#6B7280', '#14B8A6'],
  ['signal-museum', '旧信号博物馆', 'Archive of Signals', 'signal', '#0EA5E9', '#F43F5E']
];

function esc(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function icon(kind, a, b) {
  const stroke = 'stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const fillA = `fill="${a}"`;
  const fillB = `fill="${b}"`;
  const cases = {
    moto: `<g color="${a}"><circle cx="-118" cy="78" r="44" ${stroke}/><circle cx="118" cy="78" r="44" ${stroke}/><path d="M-118 78l44-92h88l56 92M-28-14l-54 92M-10-14l128 92" ${stroke}/><rect x="72" y="-98" width="76" height="54" rx="18" ${fillB}/><path d="M82-72h56" stroke="#0F172A" stroke-width="7" stroke-linecap="round"/></g>`,
    tokens: `<g><rect x="-164" y="-110" width="328" height="220" rx="28" fill="#111827" stroke="${a}" stroke-width="8"/><path d="M-116 56h48M-116 8h96M-116-40h62" stroke="${b}" stroke-width="12" stroke-linecap="round"/><circle cx="76" cy="-24" r="52" fill="${a}" opacity=".9"/><path d="M48 56c30-38 60-42 96-16" stroke="${b}" stroke-width="12" stroke-linecap="round"/></g>`,
    workflow: `<g><circle cx="-138" cy="-58" r="44" ${fillA}/><circle cx="0" cy="80" r="48" ${fillB}/><circle cx="138" cy="-58" r="44" fill="#F8FAFC"/><path d="M-100-30L-40 40M100-30L40 40M-92-58H92" stroke="#CBD5E1" stroke-width="9" stroke-linecap="round"/><path d="M-152-58h28M-14 80h28M124-58h28" stroke="#0F172A" stroke-width="8" stroke-linecap="round"/></g>`,
    news: `<g><rect x="-156" y="-112" width="312" height="224" rx="24" fill="#F8FAFC"/><rect x="-116" y="-72" width="112" height="88" rx="14" ${fillA}/><path d="M24-66h80M24-24h92M-116 54h232" stroke="#334155" stroke-width="12" stroke-linecap="round"/><path d="M-116 84h168" stroke="${b}" stroke-width="12" stroke-linecap="round"/></g>`,
    camera: `<g><rect x="-150" y="-90" width="300" height="190" rx="34" fill="#F8FAFC"/><rect x="-86" y="-122" width="98" height="46" rx="18" ${fillB}/><circle cx="0" cy="10" r="66" fill="#111827"/><circle cx="0" cy="10" r="38" ${fillA}/><circle cx="94" cy="-44" r="16" fill="#111827"/></g>`,
    screen: `<g><rect x="-166" y="-104" width="332" height="196" rx="24" fill="#F8FAFC"/><path d="M-106 26c34-84 82-84 116 0s72 84 106 0" stroke="${a}" stroke-width="14" stroke-linecap="round"/><path d="M-58 130h116M0 92v38" stroke="${b}" stroke-width="12" stroke-linecap="round"/></g>`,
    mortgage: `<g><path d="M-150-8L0-126L150-8" stroke="${a}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><rect x="-108" y="-8" width="216" height="132" rx="18" fill="#F8FAFC"/><path d="M-64 82l42-46 44 28 56-78" stroke="${b}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M-28 124h56V52h-56z" fill="#CBD5E1"/></g>`,
    cleaner: `<g><rect x="-150" y="-102" width="300" height="204" rx="30" fill="#F8FAFC"/><path d="M-84-28h168M-64 28h128M-34 78h68" stroke="#475569" stroke-width="12" stroke-linecap="round"/><path d="M-64-124h128l-18 42h-92z" ${fillA}/><path d="M96-96l56-34M114-62l62-8" stroke="${b}" stroke-width="10" stroke-linecap="round"/></g>`,
    radar: `<g><circle r="154" fill="#111827" stroke="${a}" stroke-width="8"/><circle r="104" stroke="#334155" stroke-width="6"/><circle r="54" stroke="#334155" stroke-width="6"/><path d="M0 0L112-106" stroke="${b}" stroke-width="12" stroke-linecap="round"/><path d="M0 0l144-52a154 154 0 0 1-32-54z" fill="${b}" opacity=".22"/><circle cx="-76" cy="-38" r="14" ${fillA}/><circle cx="92" cy="62" r="14" ${fillB}/></g>`,
    chat: `<g><rect x="-164" y="-98" width="238" height="126" rx="28" fill="#F8FAFC"/><path d="M-92 28l-34 54v-54" fill="#F8FAFC"/><rect x="-94" y="-52" width="112" height="14" rx="7" ${fillA}/><rect x="-94" y="-12" width="168" height="14" rx="7" fill="#94A3B8"/><rect x="-22" y="50" width="186" height="92" rx="26" ${fillB}/><path d="M116 142l32 42v-42" ${fillB}/></g>`,
    clock: `<g><circle r="142" fill="#F8FAFC"/><circle r="108" fill="#111827"/><path d="M0-52v62l48 36" stroke="${b}" stroke-width="14" stroke-linecap="round"/><path d="M-88-132l-30-34M88-132l30-34" stroke="${a}" stroke-width="12" stroke-linecap="round"/></g>`,
    timeline: `<g><path d="M-164 0H164" stroke="${a}" stroke-width="14" stroke-linecap="round"/><circle cx="-120" cy="0" r="30" fill="#F8FAFC" stroke="${b}" stroke-width="8"/><circle cx="0" cy="0" r="30" fill="#F8FAFC" stroke="${b}" stroke-width="8"/><circle cx="120" cy="0" r="30" fill="#F8FAFC" stroke="${b}" stroke-width="8"/><path d="M-120-56v-48M0 56v48M120-56v-48" stroke="#CBD5E1" stroke-width="10" stroke-linecap="round"/><path d="M-154-128h68M-34 128h68M86-128h68" stroke="#F8FAFC" stroke-width="10" stroke-linecap="round"/></g>`,
    map: `<g><path d="M-150-86l92-38 98 36 110-44v220l-110 44-98-36-92 38z" fill="#F8FAFC"/><path d="M-58-124v220M40-88v220" stroke="#CBD5E1" stroke-width="8"/><path d="M-108-26h72v72h-72zM18-48h70v70H18zM52 48h76v58H52z" fill="${a}" opacity=".9"/><path d="M-58 96l98 36" stroke="${b}" stroke-width="10" stroke-linecap="round"/></g>`,
    ocean: `<g><path d="M-180 38c42-44 84-44 126 0s84 44 126 0 84-44 126 0" stroke="${a}" stroke-width="16" stroke-linecap="round"/><path d="M-180 92c42-38 84-38 126 0s84 38 126 0 84-38 126 0" stroke="${b}" stroke-width="16" stroke-linecap="round"/><circle cx="-74" cy="-78" r="18" ${fillB}/><circle cx="70" cy="-112" r="12" ${fillA}/><circle cx="122" cy="-34" r="10" fill="#F8FAFC"/></g>`,
    eye: `<g><path d="M-172 0s62-92 172-92S172 0 172 0 110 92 0 92-172-92-172-92z" fill="#F8FAFC"/><circle r="58" ${fillA}/><circle r="26" fill="#111827"/><path d="M-96 118c58 34 134 34 192 0" stroke="${b}" stroke-width="12" stroke-linecap="round"/></g>`,
    parking: `<g><rect x="-126" y="-150" width="252" height="300" rx="34" fill="#F8FAFC"/><path d="M-48 78V-78h62c52 0 78 28 78 68s-26 68-78 68h-62" stroke="${a}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><circle cx="92" cy="-112" r="22" ${fillB}/></g>`,
    clipboard: `<g><rect x="-118" y="-136" width="236" height="272" rx="28" fill="#F8FAFC"/><rect x="-58" y="-166" width="116" height="58" rx="20" ${fillA}/><path d="M-62-44h124M-62 8h92M-62 60h124" stroke="#475569" stroke-width="12" stroke-linecap="round"/><path d="M76 74l36 36 64-82" stroke="${b}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    music: `<g><rect x="-166" y="-112" width="332" height="224" rx="28" fill="#111827" stroke="${a}" stroke-width="8"/><path d="M-122-58l38 38-38 38M-52 18h76" stroke="#F8FAFC" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M82-48v98a32 32 0 1 1-18-28V-78l84-20v98a32 32 0 1 1-18-28v-70z" fill="${b}"/></g>`,
    scale: `<g><path d="M-116-78h232l54 168H-170z" fill="#F8FAFC"/><path d="M-80-78c16-58 144-58 160 0" stroke="${a}" stroke-width="12" stroke-linecap="round"/><path d="M-74 34h148" stroke="#475569" stroke-width="12" stroke-linecap="round"/><circle cx="0" cy="34" r="28" ${fillB}/></g>`,
    letters: `<g><rect x="-154" y="-104" width="308" height="208" rx="24" fill="#F8FAFC"/><path d="M-154-64L0 28 154-64" stroke="${a}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M-104 62h86M24 62h80" stroke="${b}" stroke-width="10" stroke-linecap="round"/><path d="M-60-138h120" stroke="#CBD5E1" stroke-width="12" stroke-linecap="round"/></g>`,
    vocab: `<g><rect x="-154" y="-114" width="226" height="176" rx="26" fill="#F8FAFC"/><rect x="-72" y="-60" width="226" height="176" rx="26" fill="${a}"/><path d="M-20-8h92M-20 34h138M-20 76h76" stroke="#F8FAFC" stroke-width="12" stroke-linecap="round"/><path d="M-118-58h86M-118-18h54" stroke="${b}" stroke-width="12" stroke-linecap="round"/></g>`,
    swords: `<g transform="translate(0 -28)"><path d="M0-190L58-52L16 114H-16L-58-52z" fill="#E2E8F0"/><path d="M0-190L0 114M-38-50H38" stroke="#94A3B8" stroke-width="7" stroke-linecap="round"/><path d="M-118 116H118" stroke="${a}" stroke-width="20" stroke-linecap="round"/><path d="M-54 116c18 34 90 34 108 0" stroke="${b}" stroke-width="12" stroke-linecap="round"/><rect x="-20" y="98" width="40" height="146" rx="18" fill="#7C2D12"/><path d="M0 102v138" stroke="#F59E0B" stroke-width="6" stroke-linecap="round" opacity=".72"/><circle cx="0" cy="116" r="30" fill="#111827" stroke="${b}" stroke-width="8"/><path d="M-30 246H30" stroke="${a}" stroke-width="18" stroke-linecap="round"/></g>`,
    memory: `<g><path d="M-122 80L-52-34 24 50 118-82" stroke="${a}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-122" cy="80" r="34" fill="#F8FAFC"/><circle cx="-52" cy="-34" r="28" ${fillB}/><circle cx="24" cy="50" r="32" ${fillA}/><circle cx="118" cy="-82" r="38" fill="#F8FAFC"/><path d="M-168 126c74 42 254 42 336 0" stroke="#CBD5E1" stroke-width="10" stroke-linecap="round"/></g>`,
    stones: `<g><ellipse cx="-76" cy="82" rx="94" ry="36" fill="#F8FAFC"/><ellipse cx="44" cy="28" rx="118" ry="46" fill="#CBD5E1"/><ellipse cx="-12" cy="-52" rx="92" ry="40" ${fillA}/><path d="M-164 146c84 24 230 22 328 0" stroke="${b}" stroke-width="10" stroke-linecap="round"/><path d="M-108-136c74 34 144 34 216 0" stroke="#F8FAFC" stroke-width="10" stroke-linecap="round"/></g>`,
    signal: `<g><rect x="-146" y="-112" width="292" height="224" rx="26" fill="#111827" stroke="${a}" stroke-width="8"/><path d="M-96 34c30-72 58-72 88 0s58 72 88 0 58-72 88 0" stroke="${b}" stroke-width="12" stroke-linecap="round"/><path d="M-96-50h192M-96 80h88" stroke="#F8FAFC" stroke-width="10" stroke-linecap="round" opacity=".86"/><circle cx="104" cy="80" r="16" ${fillA}/></g>`
  };
  return cases[kind] || cases.tokens;
}

function svg([id, title, subtitle, kind, accentA, accentB]) {
  return `<svg width="1440" height="900" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1440" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F6F8FB"/>
      <stop offset="1" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="panel-${id}" x1="0" y1="0" x2="1440" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="#111827"/>
      <stop offset="1" stop-color="#1F2937"/>
    </linearGradient>
    <filter id="shadow-${id}" x="-80" y="-80" width="1600" height="1060" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="32" stdDeviation="30" flood-color="#64748B" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="1440" height="900" fill="url(#panel-${id})"/>
  <circle cx="320" cy="430" r="360" fill="${accentA}" opacity="0.12"/>
  <circle cx="1040" cy="390" r="330" fill="${accentB}" opacity="0.1"/>
  <path d="M0 690C236 610 438 622 636 690C862 768 1094 780 1440 656V900H0V690Z" fill="#0F172A" opacity="0.34"/>
  <g filter="url(#shadow-${id})">
    <rect x="150" y="118" width="1140" height="664" rx="42" fill="#111827" opacity="0.72"/>
    <rect x="214" y="174" width="1012" height="58" rx="29" fill="#263244"/>
    <circle cx="254" cy="203" r="9" fill="${accentA}"/>
    <circle cx="288" cy="203" r="9" fill="${accentB}"/>
    <rect x="342" y="194" width="272" height="17" rx="8.5" fill="#475569"/>
    <rect x="646" y="194" width="412" height="17" rx="8.5" fill="#334155"/>
    <rect x="214" y="652" width="1012" height="58" rx="29" fill="#0F172A" opacity="0.84"/>
    <rect x="278" y="677" width="308" height="11" rx="5.5" fill="${accentA}" opacity="0.9"/>
    <rect x="648" y="677" width="512" height="11" rx="5.5" fill="#475569"/>
  </g>
  <g transform="translate(720 430) scale(1.42)">
    <circle r="230" fill="${accentA}" opacity="0.12"/>
    <circle r="180" fill="${accentB}" opacity="0.1"/>
    ${icon(kind, accentA, accentB)}
  </g>
  <text x="720" y="704" text-anchor="middle" fill="#F8FAFC" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="42" font-weight="700">${esc(title)}</text>
  <text x="720" y="750" text-anchor="middle" fill="#CBD5E1" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="22">${esc(subtitle)}</text>
</svg>
`;
}

mkdirSync(thumbsDir, { recursive: true });
for (const work of works) {
  writeFileSync(join(thumbsDir, `${work[0]}.svg`), svg(work), 'utf8');
}

console.log(`Generated ${works.length} thumbnails in ${thumbsDir}`);
