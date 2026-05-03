// Tiny CSV writer. Quotes fields that contain commas, quotes, or newlines.

export const toCsv = (rows: Array<Record<string, unknown>>, columns: string[]): string => {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}\n`;
};
