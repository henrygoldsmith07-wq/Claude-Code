// Grade-boundary import helpers. Boundary values are intentionally supplied
// by the learner or teacher: they change by board, series and qualification,
// so Le Studio must not ship a made-up table and call it official.

const FIELD_ALIASES = {
  boardId: ['boardid', 'board', 'examboard', 'exam'],
  tier: ['tier', 'route'],
  series: ['series', 'examseries', 'session', 'year'],
  grade: ['grade', 'boundarygrade', 'gradeboundary', 'result'],
  minPercent: ['minpercent', 'minimumpercent', 'percent', 'percentage', 'boundarypercent'],
  minMark: ['minmark', 'minimumrawmark', 'minimummark', 'rawmark', 'mark', 'minimum'],
  maxMark: ['maxmark', 'maximumrawmark', 'maximummark', 'papermax', 'maximum', 'totalmarks'],
  source: ['source', 'sourceorganisation', 'organisation'],
  sourceUrl: ['sourceurl', 'url', 'sourcepage'],
};

const tidy = (value) => String(value ?? '').trim();
const keyOf = (value) => tidy(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const BOARD_ALIASES = {
  aqa: 'aqa-gcse',
  'aqa gcse': 'aqa-gcse',
  wjec: 'wjec-gcse',
  'wjec gcse': 'wjec-gcse',
  edexcel: 'edexcel-gcse',
  'pearson edexcel': 'edexcel-gcse',
  'pearson edexcel gcse': 'edexcel-gcse',
};

function getField(row, name) {
  const aliases = FIELD_ALIASES[name] || [];
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const hit = entries.find(([key]) => keyOf(key) === alias);
    if (hit && tidy(hit[1]) !== '') return tidy(hit[1]);
  }
  return '';
}

function number(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw.replace('%', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeBoardId(value, fallback) {
  const raw = tidy(value || fallback);
  return BOARD_ALIASES[raw.toLowerCase()] || raw || null;
}

function boundaryMapFromRows(rows, defaults = {}) {
  const grouped = new Map();
  for (const row of rows) {
    const grade = getField(row, 'grade');
    if (!grade) continue;
    const minPercent = number(getField(row, 'minPercent'));
    const minMark = number(getField(row, 'minMark'));
    const maxMark = number(getField(row, 'maxMark')) || number(defaults.maxMark);
    const value = minPercent ?? (minMark !== null && maxMark > 0 ? (minMark / maxMark) * 100 : null);
    if (value === null || value < 0 || value > 100) continue;
    const boardId = safeBoardId(getField(row, 'boardId'), defaults.boardId);
    const tier = tidy(getField(row, 'tier') || defaults.tier).toLowerCase() || null;
    const series = tidy(getField(row, 'series') || defaults.series) || 'Imported series';
    const key = JSON.stringify([boardId, tier, series]);
    if (!grouped.has(key)) grouped.set(key, { boardId, tier, series, boundaries: {}, source: getField(row, 'source') || defaults.source, sourceUrl: getField(row, 'sourceUrl') || defaults.sourceUrl });
    const target = grouped.get(key);
    target.boundaries[grade] = Math.max(Number(target.boundaries[grade] ?? 0), Math.round(value * 100) / 100);
  }
  return [...grouped.values()];
}

function mapFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [grade, raw] of Object.entries(value)) {
    const parsed = number(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 100) out[tidy(grade)] = Math.round(parsed * 100) / 100;
  }
  return out;
}

export function normaliseBoundarySet(input = {}, defaults = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const boundaries = mapFromObject(source.boundaries || source.gradeBoundaries);
  const rows = Array.isArray(source.rows) ? boundaryMapFromRows(source.rows, { ...defaults, ...source }) : [];
  const fromRows = rows[0]?.boundaries || {};
  const merged = { ...fromRows, ...boundaries };
  const entries = Object.entries(merged).filter(([grade, value]) => grade && Number.isFinite(Number(value)));
  if (entries.length < 2) throw new Error('Add at least two grade boundaries with percentages or raw marks.');
  const boardId = safeBoardId(source.boardId || source.board, defaults.boardId);
  const tier = tidy(source.tier || defaults.tier).toLowerCase() || null;
  const series = tidy(source.series || defaults.series) || 'Imported series';
  const sourceName = tidy(source.source || source.sourceName || defaults.source) || 'Imported by learner';
  const sourceUrl = tidy(source.sourceUrl || defaults.sourceUrl) || null;
  const id = tidy(source.id) || `boundaries-${(boardId || 'board').replace(/[^a-z0-9]+/gi, '-')}-${(tier || 'all').replace(/[^a-z0-9]+/gi, '-')}-${series.replace(/[^a-z0-9]+/gi, '-')}`.toLowerCase();
  return {
    id,
    boardId,
    tier,
    series,
    maxMark: number(source.maxMark) || null,
    boundaries: Object.fromEntries(entries),
    source: sourceName,
    sourceUrl,
    importedAt: source.importedAt || new Date().toISOString(),
  };
}

function splitDelimited(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function rowsFromDelimited(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Paste a header row and at least one boundary row.');
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimited(lines[0], delimiter);
  return lines.slice(1).map((line) => Object.fromEntries(splitDelimited(line, delimiter).map((cell, index) => [headers[index] || `field${index}`, cell])));
}

export function parseBoundaryImport(input, defaults = {}) {
  if (input && typeof input === 'object') {
    if (Array.isArray(input)) {
      const sets = boundaryMapFromRows(input, defaults).map((set) => normaliseBoundarySet(set, defaults));
      if (!sets.length) throw new Error('No usable boundary rows found.');
      return { format: 'rows', sets, warnings: [] };
    }
    if (Array.isArray(input.rows)) {
      const sets = boundaryMapFromRows(input.rows, { ...defaults, ...input }).map((set) => normaliseBoundarySet({ ...input, ...set }, defaults));
      if (!sets.length) throw new Error('No usable boundary rows found.');
      return { format: 'json-rows', sets, warnings: [] };
    }
    return { format: 'json', sets: [normaliseBoundarySet(input, defaults)], warnings: [] };
  }

  const text = tidy(input);
  if (!text) throw new Error('Paste JSON, CSV or tab-separated grade boundaries first.');
  try {
    const parsed = JSON.parse(text);
    return parseBoundaryImport(parsed, defaults);
  } catch (error) {
    if (/at least two|usable boundary|header row|Paste JSON/.test(error.message)) throw error;
  }
  const rows = rowsFromDelimited(text);
  const sets = boundaryMapFromRows(rows, defaults).map((set) => normaliseBoundarySet(set, defaults));
  if (!sets.length) throw new Error('No usable boundary rows found. Add grade plus minPercent, or minMark and maxMark.');
  return { format: 'csv', sets, warnings: [] };
}
