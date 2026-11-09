import { pickerDate, pickerDay, rentalDateErrors, rentalToday } from '../rental-dates';

describe('Fechas de renta', () => {
  it('usa el día de Ciudad de México y no el día UTC', () => {
    expect(rentalToday(new Date('2026-10-31T05:59:59Z'))).toBe('2026-10-30');
    expect(rentalToday(new Date('2026-10-31T06:00:00Z'))).toBe('2026-10-31');
  });
  it('rechaza fechas pasadas, imposibles y devolución anterior al inicio', () => {
    expect(rentalDateErrors('2026-10-29', '2026-10-30', '2026-10-30').start).toContain('pasado');
    expect(rentalDateErrors('2026-10-30', '2026-10-29', '2026-10-30').end).toContain('pasado');
    expect(rentalDateErrors('2026-11-02', '2026-11-01', '2026-10-30').end).toContain('posterior');
    expect(rentalDateErrors('2027-02-31', '2027-03-01', '2026-10-30').start).toContain(
      'Selecciona',
    );
    expect(rentalDateErrors('2026-10-30', '2026-10-30', '2026-10-30')).toEqual({
      start: undefined,
      end: undefined,
    });
  });
  it('invalida un borrador al pasar al día siguiente y conserva el día elegido sin conversión UTC', () => {
    expect(rentalDateErrors('2026-10-30', '2026-11-02', '2026-10-31').start).toContain('pasado');
    expect(pickerDay(pickerDate('2028-02-29'))).toBe('2028-02-29');
  });
});
