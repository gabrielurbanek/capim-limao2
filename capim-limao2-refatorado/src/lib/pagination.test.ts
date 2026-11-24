import { describe, expect, it } from 'vitest';
import { fetchAllPages } from './pagination';

describe('fetchAllPages', () => {
  it('busca blocos consecutivos até a última página curta', async () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    const ranges: Array<[number, number]> = [];
    const all = await fetchAllPages(async (from, to) => {
      ranges.push([from, to]);
      return { data: values.slice(from, to + 1), error: null };
    }, 2);
    expect(all).toEqual(values);
    expect(ranges).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it('retorna array vazio e propaga erro de consulta', async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: null }), 10)).resolves.toEqual([]);
    await expect(fetchAllPages(async () => ({ data: null, error: { message: 'RLS denied' } }))).rejects.toThrow('RLS denied');
  });
});
