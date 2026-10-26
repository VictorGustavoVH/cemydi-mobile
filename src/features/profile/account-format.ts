const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const accountMoney = (value: number) => `${money.format(value)} MXN`;
const date = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });
export const accountDate = (value: string) => date.format(new Date(value));
