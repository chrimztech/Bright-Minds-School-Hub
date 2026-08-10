export function money(n: number | null | undefined, currency = "ZMW") {
  const v = Number(n ?? 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v); }
  catch { return `${currency} ${v.toFixed(2)}`; }
}

export function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}