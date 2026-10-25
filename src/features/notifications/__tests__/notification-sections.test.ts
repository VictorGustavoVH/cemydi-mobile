import { notificationSections } from '../notification-presentation';
import type { CustomerNotification } from '../notification-schemas';

function notice(id: string, date: Date): CustomerNotification {
  return {
    id,
    category: 'SYSTEM',
    title: id,
    body: 'Mensaje',
    destinationType: 'NONE',
    destinationId: null,
    createdAt: date.toISOString(),
    readAt: null,
  };
}
it('groups by calendar days across midnight and merges a day spanning loaded pages', () => {
  const now = new Date(2026, 9, 18, 0, 5);
  const items = [
    notice('today', new Date(2026, 9, 18, 0, 1)),
    notice('yesterday-one', new Date(2026, 9, 17, 23, 59)),
    notice('yesterday-two', new Date(2026, 9, 17, 8)),
    notice('earlier', new Date(2026, 9, 16, 18)),
  ];
  const groups = notificationSections(items, now);
  expect(groups.map((group) => group.title)).toEqual(['Hoy', 'Ayer', '16 de octubre']);
  expect(groups.map((group) => group.data.map((item) => item.id))).toEqual([
    ['today'],
    ['yesterday-one', 'yesterday-two'],
    ['earlier'],
  ]);
});
it('keeps different years separate and includes the year in older section labels', () => {
  const groups = notificationSections(
    [notice('current', new Date(2026, 9, 16)), notice('older', new Date(2025, 9, 16))],
    new Date(2026, 9, 18),
  );
  expect(groups).toHaveLength(2);
  expect(groups[0].key).not.toEqual(groups[1].key);
  expect(groups[1].title).toContain('2025');
});
