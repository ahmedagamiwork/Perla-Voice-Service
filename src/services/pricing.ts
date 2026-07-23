export function calculateLineTotal(price: number, quantity: number): number {
  if (!Number.isFinite(price) || price < 0) throw new Error('INVALID_PRICE');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('INVALID_QUANTITY');
  return Math.round(price * quantity * 100) / 100;
}

export function calculateDraftTotal(lines: Array<{ price: number; quantity: number }>): number {
  if (!lines.length) throw new Error('EMPTY_ITEMS');
  return Math.round(lines.reduce((sum, line) => sum + calculateLineTotal(line.price, line.quantity), 0) * 100) / 100;
}
