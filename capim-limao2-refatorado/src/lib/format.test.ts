import { describe, expect, it } from 'vitest';
import { convertQuantity, isValidQuantity, money, provisionalLineTotal, quantityText, slugify } from './format';

describe('formatação monetária', () => {
  it('formata BRL sem usar ponto flutuante', () => {
    expect(money('1234.56')).toBe('R$ 1.234,56');
    expect(money('3.333')).toBe('R$ 3,33');
  });
  it('arredonda half-up no subtotal provisório', () => {
    expect(provisionalLineTotal('3.333', '0.333')).toBe('1.11');
  });
  it.each([
    ['0.250', '40.00', '10.00'],
    ['0.500', '40.00', '20.00'],
    ['0.750', '40.00', '30.00'],
    ['1.250', '40.00', '50.00'],
  ])('calcula %s kg a R$ %s/kg = R$ %s', (quantity, price, total) => {
    expect(provisionalLineTotal(price, quantity)).toBe(total);
  });
});

describe('quantidade e unidade', () => {
  it('aceita somente quantidades válidas para unidade, g e kg', () => {
    expect(isValidQuantity('2', 'un')).toBe(true);
    expect(isValidQuantity('1.5', 'un')).toBe(false);
    expect(isValidQuantity('250', 'g')).toBe(true);
    expect(isValidQuantity('250.5', 'g')).toBe(false);
    expect(isValidQuantity('1.250', 'kg')).toBe(true);
    expect(isValidQuantity('1.2501', 'kg')).toBe(false);
    expect(isValidQuantity('0', 'kg')).toBe(false);
  });
  it('converte g↔kg com três casas decimais', () => {
    expect(convertQuantity('250', 'g', 'kg')).toBe('0.250');
    expect(convertQuantity('1.25', 'kg', 'g')).toBe('1250.000');
    expect(() => convertQuantity('1', 'un', 'kg')).toThrow('Não é possível converter unidade para peso.');
  });
  it('formata kg sem vírgulas vazias e preserva gramas inteiras', () => {
    expect(quantityText('1.000', 'kg')).toBe('1 kg');
    expect(quantityText('1.250', 'kg')).toBe('1,25 kg');
    expect(quantityText('250', 'g')).toBe('250 g');
  });
});

describe('slug de produto', () => {
  it('remove acentos e normaliza espaços', () => {
    expect(slugify('Chá de Maçã & Canela')).toBe('cha-de-maca-canela');
  });
});
