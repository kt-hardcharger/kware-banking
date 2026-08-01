// Builds a "Add to Google Calendar" link for the weekly transfer reminder.
// No OAuth/API — this just deep-links to Google Calendar's event-creation
// template with the fields pre-filled. The user still clicks Save.

function addDaysISO(dateISO, days) {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function buildGoogleCalendarUrl({ title, dateISO, details }) {
  const start = dateISO.replace(/-/g, '')
  const end = addDaysISO(dateISO, 1).replace(/-/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: details || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
