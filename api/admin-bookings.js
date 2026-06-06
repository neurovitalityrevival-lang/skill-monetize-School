export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASS   = process.env.ADMIN_PASSWORD;

  if (req.headers['x-admin-password'] !== ADMIN_PASS)
    return res.status(401).json({ error: 'Unauthorized' });

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?select=*,slots(date,start_time)&order=created_at.desc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  res.status(200).json(await r.json());
}
