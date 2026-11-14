function localDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function requestDateRange(from: string, to: string) {
  const start = from ? localDate(from) : null;
  const end = to ? localDate(to) : null;
  if ((from && !start) || (to && !end) || (start && end && start > end))
    return null;
  // Advance the local calendar day rather than adding 24 hours across DST changes.
  if (end) end.setDate(end.getDate() + 1);

  return {
    requestedFrom: start?.toISOString() ?? '',
    requestedTo: end?.toISOString() ?? '',
  };
}
