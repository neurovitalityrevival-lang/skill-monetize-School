import { getSupabaseConfig, handleApiError, supabaseFetch } from './_lib/supabase.js';

function checkAdmin(req, res) {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    res.status(503).json({ error: 'ADMIN_PASSWORD が Vercel 環境変数に設定されていません' });
    return false;
  }
  if (req.headers['x-admin-password'] !== adminPass) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    getSupabaseConfig();
    if (!checkAdmin(req, res)) return;

    if (req.method === 'GET') {
      const { year, month } = req.query;
      let path = '/rest/v1/slots?order=date,start_time';
      if (year && month) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const start = `${y}-${String(m).padStart(2, '0')}-01`;
        const nm = m === 12 ? 1 : m + 1;
        const ny = m === 12 ? y + 1 : y;
        const end = `${ny}-${String(nm).padStart(2, '0')}-01`;
        path += `&date=gte.${start}&date=lt.${end}`;
      }
      const r = await supabaseFetch(path);
      if (!r.ok) return res.status(502).json({ error: '枠データの取得に失敗しました', detail: r.data });
      return res.status(200).json(Array.isArray(r.data) ? r.data : []);
    }

    if (req.method === 'POST') {
      const { date, dates, times, blocked } = req.body;
      const targetDates = dates || (date ? [date] : []);
      if (!targetDates.length || !times?.length) {
        return res.status(400).json({ error: 'date/dates and times are required' });
      }

      const rows = [];
      for (const d of targetDates) {
        for (const t of times) {
          rows.push({
            date: d,
            start_time: t,
            is_available: !blocked,
            is_booked: !!blocked,
          });
        }
      }

      const r = await supabaseFetch('/rest/v1/slots?on_conflict=date,start_time', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
        body: JSON.stringify(rows),
      });

      if (!r.ok) return res.status(502).json({ error: '枠の追加に失敗しました', detail: r.data });
      return res.status(200).json({ success: true, count: rows.length });
    }

    if (req.method === 'PATCH') {
      const { ids, is_booked, is_available } = req.body;
      if (!ids?.length) return res.status(400).json({ error: 'ids are required' });

      const r = await supabaseFetch(`/rest/v1/slots?id=in.(${ids.join(',')})`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_booked, is_available }),
      });

      if (!r.ok) return res.status(502).json({ error: '枠の更新に失敗しました', detail: r.data });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { ids, force } = req.query;
      if (!ids) return res.status(400).json({ error: 'ids are required' });

      let path = `/rest/v1/slots?id=in.(${ids})`;
      if (force !== 'true') path += '&is_booked=eq.false';

      const r = await supabaseFetch(path, { method: 'DELETE' });
      if (!r.ok) return res.status(502).json({ error: '枠の削除に失敗しました', detail: r.data });
      return res.status(200).json({ success: true });
    }

    return res.status(405).end();
  } catch (error) {
    return handleApiError(res, error);
  }
}
