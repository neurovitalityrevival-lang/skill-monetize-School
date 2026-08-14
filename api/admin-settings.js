import { getSupabaseConfig, handleApiError, supabaseFetch } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    getSupabaseConfig();

    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) {
      return res.status(503).json({ error: 'ADMIN_PASSWORD が Vercel 環境変数に設定されていません' });
    }
    if (req.headers['x-admin-password'] !== adminPass) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      const r = await supabaseFetch('/rest/v1/admin_settings');
      if (!r.ok) return res.status(502).json({ error: '設定の取得に失敗しました', detail: r.data });
      return res.status(200).json(Array.isArray(r.data) ? r.data : []);
    }

    if (req.method === 'POST') {
      const { key, value } = req.body;
      const r = await supabaseFetch('/rest/v1/admin_settings', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ key, value }),
      });
      if (!r.ok) return res.status(502).json({ error: '設定の保存に失敗しました', detail: r.data });
      return res.status(200).json({ success: true });
    }

    return res.status(405).end();
  } catch (error) {
    return handleApiError(res, error);
  }
}
