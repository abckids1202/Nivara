import { expect, it } from 'vitest';
import { isSellable, sellableStock } from '../lib/inventory.ts';

it('never exposes reserved units as sellable stock', () => {
  expect(sellableStock(5, 2)).toBe(3);
  expect(sellableStock(5, 5)).toBe(0);
  expect(sellableStock(5, 7)).toBe(0);
  expect(isSellable(5, 2)).toBe(true);
  expect(isSellable(5, 5)).toBe(false);
});
