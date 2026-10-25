import type { CustomerNotification } from './notification-schemas';

function calendarDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function notificationSections(items: CustomerNotification[], now = new Date()) {
  const today = calendarDay(now);
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  const yesterday = calendarDay(previous);
  const sections = new Map<string, { key: string; title: string; data: CustomerNotification[] }>();
  for (const item of items) {
    const date = new Date(item.createdAt);
    const valid = Number.isFinite(date.getTime());
    const key = valid ? calendarDay(date) : 'earlier';
    const title =
      key === today
        ? 'Hoy'
        : key === yesterday
          ? 'Ayer'
          : valid
            ? date.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
              })
            : 'Anteriores';
    const section = sections.get(key);
    if (section) section.data.push(item);
    else sections.set(key, { key, title, data: [item] });
  }
  return [...sections.values()];
}

export function notificationTime(value: string, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Recientemente';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${Math.max(1, months)} ${months <= 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(days / 365);
  return `Hace ${Math.max(1, years)} ${years <= 1 ? 'año' : 'años'}`;
}

export function notificationAction(item: { category: string; destinationType: string }) {
  if (item.destinationType === 'PRODUCT')
    return item.category === 'OFFER' ? 'Ver oferta' : 'Ver producto';
  if (item.destinationType === 'PROMOTION') return 'Ver oferta';
  if (item.destinationType === 'RENTAL') return 'Ver renta';
  if (item.destinationType === 'ACCOUNT') return 'Revisar cuenta';
  return null;
}
