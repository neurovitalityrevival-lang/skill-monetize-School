export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const ADMIN_PASS   = process.env.ADMIN_PASSWORD;

  if (req.headers['x-admin-password'] !== ADMIN_PASS)
    return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { year, month } = req.query;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/slots?date=gte.${startDate}&date=lte.${endDate}&order=date,start_time`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    return res.status(200).json(await r.json());
  }

  if (req.method === 'POST') {
    const { date, dates, times, blocked } = req.body;
    // datesが配列なら一括、dateが単体なら従来通り
    const targetDates = dates || [date];
    const rows = [];
    for (const d of targetDates) {
      for (const t of times) {
        rows.push({ date: d, start_time: t, is_available: !blocked, is_booked: !!blocked });
      }
    }
    await fetch(`${SUPABASE_URL}/rest/v1/slots`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=ignore-duplicates'
      },
      body: JSON.stringify(rows)
    });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { ids, is_booked, is_available } = req.body;
    await fetch(`${SUPABASE_URL}/rest/v1/slots?id=in.(${ids.join(',')})`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ is_booked, is_available })
    });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { ids, force } = req.query;
    let url = `${SUPABASE_URL}/rest/v1/slots?id=in.(${ids})`;
    if (!force) url += '&is_booked=eq.false';
    await fetch(url, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return res.status(200).json({ success: true });
  }

  res.status(405).end();
}
