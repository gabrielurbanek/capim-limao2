import { describe, expect, it } from 'vitest';
import { isPortionPreset, quantityForPortion } from './quantityPreset';

describe('quantity presets', () => {
  it('converts gram portions to the units supported by products', () => {
    expect(quantityForPortion('250g', 'kg')).toBe('0.250');
    expect(quantityForPortion('500g', 'kg')).toBe('0.500');
    expect(quantityForPortion('1kg', 'kg')).toBe('1.000');
    expect(quantityForPortion('250g', 'g')).toBe('250');
  });

  it('keeps unit-priced products at one unit and validates URL presets', () => {
    expect(quantityForPortion('500g', 'un')).toBe('1');
    expect(quantityForPortion(undefined, 'un')).toBe('1');
    expect(isPortionPreset('500g')).toBe(true);
    expect(isPortionPreset('500 kg')).toBe(false);
  });
});
