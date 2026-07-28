export const fmtNumber = (locale: string) => new Intl.NumberFormat(locale);

export const fmtCurrency = (locale: string, currency = 'USD') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency });

export const fmtPricePerLb = (locale: string, cents: number, currency = 'USD') =>
  `${fmtCurrency(locale, currency).format(cents / 100)}/lb`;

export const fmtDate = (locale: string, dateString: string) =>
  new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateString));

export const fmtList = (locale: string) =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
