import {
  displayDraftDate,
  formatDraftDateInput,
  formatPreviewMoney,
  getCartEntries,
  getPreviewSummary,
  parseDraftDate,
  previewAmount,
} from '../cart-preview';

describe('Borradores y resumen ilustrativo del carrito', () => {
  it.each([
    ['29/02/2028', '2028-02-29'],
    [' 01/03/2027 ', '2027-03-01'],
    ['29/02/2027', null],
    ['31/04/2027', null],
    ['00/12/2027', null],
    ['01/13/2027', null],
    ['01/01/0999', null],
    ['1/3/2027', null],
    ['', null],
  ])('valida la fecha %s', (input, expected) => {
    expect(parseDraftDate(input)).toBe(expected);
  });

  it.each([
    ['01032027', '01/03/2027'],
    ['01/03/2027abc99', '01/03/2027'],
    ['010', '01/0'],
    ['', ''],
  ])('formatea la entrada %s', (input, expected) => {
    expect(formatDraftDateInput(input)).toBe(expected);
  });

  it('presenta una fecha guardada y precios de fixtures', () => {
    expect(displayDraftDate('2027-03-01')).toBe('01/03/2027');
    expect(previewAmount('$3,850')).toBe(3850);
    expect(formatPreviewMoney(3850)).toBe('$3,850.00 MXN');
  });

  it('omite productos ausentes y resume solo unidades seleccionadas por modalidad', () => {
    const entries = getCartEntries([
      { productId: 'wheelchair', mode: 'purchase', quantity: 2, selected: true },
      { productId: 'wheelchair', mode: 'rental', quantity: 3, selected: true },
      { productId: 'oxygen', mode: 'rental', quantity: 1, selected: false },
      { productId: 'missing', mode: 'purchase', quantity: 1, selected: true },
    ]);
    expect(entries).toHaveLength(3);
    expect(getPreviewSummary(entries)).toEqual({ units: 5, amount: 7835, deposit: 1500 });
    expect(getPreviewSummary([])).toEqual({ units: 0, amount: 0, deposit: 0 });
    expect(getPreviewSummary(entries.filter(({ item }) => !item.selected))).toEqual({
      units: 0,
      amount: 0,
      deposit: 0,
    });
  });
});
