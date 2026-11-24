function protectSpreadsheetFormula(value: string): string {
  return /^[\t\r ]*[=+@-]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  const safe = protectSpreadsheetFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV em UTF-8 com BOM, delimitador comum em planilhas pt-BR e linhas CRLF. */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}`;
}
