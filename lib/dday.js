export function ddayInfo(dueDateStr) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  const label = diff === 0 ? "D-day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  const badgeClass = diff <= 5 ? "badge-red" : diff <= 14 ? "badge-yellow" : "badge-blue";
  return { label, badgeClass };
}
