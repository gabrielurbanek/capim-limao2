import { describe, expect, it } from 'vitest';
import { serializeCsv } from './csv';

describe('serializeCsv', () => {
  it('preserves accents and escapes separators, quotes and line breaks', () => {
    expect(serializeCsv([['Produto', 'Descrição'], ['Limão; seco', 'erva "inteira"\nembalada']]))
      .toBe('\uFEFF"Produto";"Descrição"\r\n"Limão; seco";"erva ""inteira""\nembalada"');
  });

  it('prefixes spreadsheet formula-like values', () => {
    expect(serializeCsv([['=1+1', ' @SUM(A1:A2)', '-2']]))
      .toBe('\uFEFF"\'=1+1";"\' @SUM(A1:A2)";"\'-2"');
  });
});
