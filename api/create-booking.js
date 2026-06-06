import { Resend } from 'resend';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { slotId, name, email, phone, menu, message } = req.body;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const OWNER_EMAIL  = process.env.OWNER_EMAIL;
  const ZOOM_URL     = process.env.ZOOM_URL;
  const BRAND_NAME   = process.env.BRAND_NAME || 'スキルマネタイズスクール';

  // スロット確認
  const slotRes = await fetch(
    `${SUPABASE_URL}/rest/v1/slots?id=eq.${slotId}&is_available=eq.true&is_booked=eq.false`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const slots = await slotRes.json();
  if (!slots.length) return res.status(409).json({ error: 'この枠はすでに埋まっています' });

  const slot = slots[0];
  const dateLabel = new Date(slot.date + 'T00:00:00+09:00').toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
  const startTime = slot.start_time.slice(0, 5);

  // 連続60分（15分×4枠）確認
  const allSlotsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/slots?date=eq.${slot.date}&is_available=eq.true&is_booked=eq.false&order=start_time`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const daySlots = await allSlotsRes.json();
  const startIdx = daySlots.findIndex(s => s.id === slotId);
  const consecutive = daySlots.slice(startIdx, startIdx + 4);
  if (consecutive.length < 4) return res.status(409).json({ error: '連続枠が不足しています' });

  const consecutiveIds = consecutive.map(s => s.id);

  // bookings INSERT
  await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ slot_id: slotId, name, email, phone, menu, message })
  });

  // 連続スロットをis_booked=trueに更新
  await fetch(
    `${SUPABASE_URL}/rest/v1/slots?id=in.(${consecutiveIds.join(',')})`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ is_booked: true })
    }
  );

  // メール送信
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: `${BRAND_NAME} 予約 <onboarding@resend.dev>`,
    to: [OWNER_EMAIL],
    subject: `【予約通知】${name}様 ${dateLabel} ${startTime}〜`,
    html: `<h2>新しい予約が入りました</h2>
<p><strong>日時：</strong>${dateLabel} ${startTime}〜</p>
<p><strong>メニュー：</strong>${menu}</p>
<p><strong>お名前：</strong>${name}</p>
<p><strong>メール：</strong>${email}</p>
<p><strong>電話：</strong>${phone}</p>
<p><strong>ご相談内容：</strong>${message || 'なし'}</p>
<hr>
<p>Zoom: <a href="${ZOOM_URL}">${ZOOM_URL}</a></p>`
  });

  await resend.emails.send({
    from: `${BRAND_NAME} <onboarding@resend.dev>`,
    to: [email],
    subject: `ご予約を承りました（${dateLabel} ${startTime}〜）`,
    html: `<h2>${name} 様</h2>
<p>ご予約ありがとうございます。以下の内容でご予約を承りました。</p>
<table border="1" cellpadding="8" style="border-collapse:collapse;">
<tr><td><strong>日時</strong></td><td>${dateLabel} ${startTime}〜</td></tr>
<tr><td><strong>メニュー</strong></td><td>${menu}</td></tr>
<tr><td><strong>形式</strong></td><td>Zoom（オンライン）</td></tr>
</table>
<h3>Zoom接続先</h3>
<p><a href="${ZOOM_URL}">${ZOOM_URL}</a></p>
<p>セッション当日は5分前までにZoomにご入室ください。</p>
<p>ご不明な点は ${OWNER_EMAIL} までご連絡ください。</p>
<p style="margin-top:24px;">${BRAND_NAME}<br>小松 大将</p>`
  });

  res.status(200).json({ success: true });
}
