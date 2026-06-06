export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { year, month } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const slotsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/slots?date=gte.${startDate}&date=lte.${endDate}&order=date,start_time`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const slots = await slotsRes.json();

  const settingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.daily_capacity_mins`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const settings = await settingsRes.json();
  const maxMins = parseInt(settings[0]?.value || '180');

  const bookedByDate = {};
  slots.filter(s => s.is_booked).forEach(s => {
    bookedByDate[s.date] = (bookedByDate[s.date] || 0) + 15;
  });

  const available = slots.filter(s => {
    if (!s.is_available || s.is_booked) return false;
    if ((bookedByDate[s.date] || 0) >= maxMins) return false;
    const hour = parseInt(s.start_time.split(':')[0]);
    if (hour >= 22) return false;
    return true;
  });

  res.status(200).json(available);
}
