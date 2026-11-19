export const DEFAULT_CANVAS_COLUMNS = 36;
export const MAX_CANVAS_ROW = 255;

/** Validate optional presentation data independently of the semantic model.
 * @param {object|undefined} input Saved canvas state; absent in older v1 backups.
 * @param {string[]} tokenIds Canonical identities in the current source unit.
 * @returns {{columns:number,words:object}} Detached grid coordinates.
 */
export function normalizeAnalysisPresentation(input, tokenIds) {
  if (input === undefined) return { columns: DEFAULT_CANVAS_COLUMNS, words: {} };
  if (!input || !Number.isInteger(input.columns) || input.columns < 8 || input.columns > 80 ||
    !input.words || typeof input.words !== 'object' || Array.isArray(input.words)) throw new Error('Invalid canvas presentation.');
  const known = new Set(tokenIds);
  const words = Object.fromEntries(Object.entries(input.words).map(([id, point]) => {
    if (!known.has(id) || !point || !Number.isInteger(point.column) || !Number.isInteger(point.row) ||
      point.column < 0 || point.column >= input.columns || point.row < 0 || point.row > MAX_CANVAS_ROW) {
      throw new Error('Canvas positions must refer to known words and valid grid cells.');
    }
    return [id, { column: point.column, row: point.row }];
  }));
  return { columns: input.columns, words };
}
