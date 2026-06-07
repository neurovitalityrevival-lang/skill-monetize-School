import { Resend } from 'resend';
import crypto from 'crypto';
import https from 'https';

// ── Meta CAPI ──
function sha256(str) {
  return str ? crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex') : null;
}

function sendCAPI({ name, email, phone, clientIp, userAgent, fbc, fbp, menu, sourceUrl }) {
  const PID = '2080933312746435';
  const AT  = 'EAAU7PbtGoZAIBReDwLpfbbo6AvazK5yqebVjLuEZCN2IKvNoh9Y4Gkbb2jrD9v2HWHpgUkKKJhZCvsba65MKnj3wLP1ZAzE5R7GKr8j4lwZBEcPcdC3FVGmLefu3HsjVV66Wf7EZCCRVi5M4SqM0HXlxPnHGz85zmmqpWUVNSBvS95wO3S1dASP3ag2vRPXkEa';
  const ud = {};
  if (email) ud.em = [sha256(email)];
  if (phone) ud.ph = [sha256(phone.replace(/\D/g,''))];
  if (name) {
    const parts = name.trim().split(/\s+/);
    ud.fn = [sha256(parts[0])];
    if (parts.length > 1) ud.ln = [sha256(parts[parts.length - 1])];
  }
  if (clientIp)  ud.client_ip_address = clientIp;
  if (userAgent) ud.client_user_agent = userAgent;
  if (fbc) ud.fbc = fbc;
  if (fbp) ud.fbp = fbp;

  const payload = JSON.stringify({
    data: [{
      event_name: 'CompleteRegistration',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `sms_reg_${Date.now()}`,
      action_source: 'website',
      event_source_url: sourceUrl || 'https://skill-monetize-school.vercel.app/booking.html',
      user_data: ud,
      custom_data: {
        content_name: menu || 'スキルマネタイズスクール 無料相談',
        content_category: 'skill-monetize',
        currency: 'JPY',
        value: 0
      }
    }]
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v19.0/${PID}/events?access_token=${AT}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(d)); });
    req.on('error', (e) => { console.error('CAPI error:', e.message); resolve(null); });
    req.write(payload);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { slotId, name, email, phone, menu, message, sourceUrl, fbc, fbp } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';
  const userAgent = req.headers['user-agent'] || '';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const OWNER_EMAIL  = process.env['オーナーのメールアドレス'] || process.env.OWNER_EMAIL;
  const ZOOM_URL     = process.env['ズームURL'] || process.env.ZOOM_URL;
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

  // Meta CAPI（失敗しても予約は成功扱い）
  try {
    await sendCAPI({ name, email, phone, clientIp, userAgent, fbc, fbp, menu, sourceUrl });
  } catch(e) {
    console.error('CAPI送信エラー:', e.message);
  }

  res.status(200).json({ success: true });
}
