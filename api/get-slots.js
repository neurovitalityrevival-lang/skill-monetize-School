import { getSupabaseConfig, handleApiError, supabaseFetch } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    getSupabaseConfig();

    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    const end = `${ny}-${String(nm).padStart(2, '0')}-01`;

    const [availableRes, bookedRes, settingsRes] = await Promise.all([
      supabaseFetch(
        `/rest/v1/slots?date=gte.${start}&date=lt.${end}&is_available=eq.true&is_booked=eq.false&order=date,start_time`
      ),
      supabaseFetch(`/rest/v1/slots?date=gte.${start}&date=lt.${end}&is_booked=eq.true`),
      supabaseFetch('/rest/v1/admin_settings?key=eq.daily_capacity_mins'),
    ]);

    if (!availableRes.ok) {
      return res.status(502).json({ error: '空き枠の取得に失敗しました', detail: availableRes.data });
    }

    const availableData = Array.isArray(availableRes.data) ? availableRes.data : [];
    const bookedData = Array.isArray(bookedRes.data) ? bookedRes.data : [];
    const settingsData = Array.isArray(settingsRes.data) ? settingsRes.data : [];

    let dailyCapacityMins = 180;
    if (settingsData.length > 0) {
      dailyCapacityMins = parseInt(settingsData[0].value, 10) || 180;
    }

    const bookedMinsPerDay = {};
    bookedData.forEach((s) => {
      bookedMinsPerDay[s.date] = (bookedMinsPerDay[s.date] || 0) + 15;
    });

    const filtered = availableData
      .filter((s) => s.start_time.substring(0, 5) < '22:00')
      .filter((s) => (bookedMinsPerDay[s.date] || 0) < dailyCapacityMins);

    return res.status(200).json(filtered);
  } catch (error) {
    return handleApiError(res, error);
  }
}
