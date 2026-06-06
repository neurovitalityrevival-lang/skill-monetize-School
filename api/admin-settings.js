export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASS   = process.env.ADMIN_PASSWORD;

  if (req.headers['x-admin-password'] !== ADMIN_PASS)
    return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_settings`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    return res.status(200).json(await r.json());
  }

  if (req.method === 'POST') {
    const { key, value } = req.body;
    await fetch(`${SUPABASE_URL}/rest/v1/admin_settings`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key, value })
    });
    return res.status(200).json({ success: true });
  }

  res.status(405).end();
}
