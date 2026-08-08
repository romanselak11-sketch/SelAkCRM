/** Форматирование оставшегося времени демо. */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 3600) return 'меньше часа';
  if (s < 86400) {
    const hours = Math.floor(s / 3600);
    return `${hours} ${pluralHours(hours)}`;
  }
  const days = Math.floor(s / 86400);
  return `${days} ${pluralDays(days)}`;
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

function pluralHours(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'час';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'часа';
  return 'часов';
}
