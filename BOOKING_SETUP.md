# THE SHIFT 予約システム — Vercel 環境変数

予約ページ・管理画面が動くには、Vercel プロジェクト **skill-monetize-school** に以下を設定してください。

**Settings → Environment Variables → Production / Preview / Development すべてに追加**

| 変数名 | 必須 | 説明 |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase プロジェクト URL（例: `https://xxxxx.supabase.co`） |
| `SUPABASE_ANON_KEY` | ✅ | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | 推奨 | service_role key（サーバー側の書き込み用・非公開） |
| `ADMIN_PASSWORD` | ✅ | 管理画面ログイン用パスワード |
| `RESEND_API_KEY` | ✅ | Resend の API キー（予約確認メール） |
| `OWNER_EMAIL` | ✅ | 予約通知の送信先メール |
| `ZOOM_URL` | ✅ | Zoom ミーティング URL |
| `BRAND_NAME` | 任意 | メール署名（デフォルト: THE SHIFT） |
| `OWNER_NAME` | 任意 | メール署名（デフォルト: 中川裕幸） |

## Supabase 初回セットアップ

1. [supabase.com](https://supabase.com) で THE SHIFT 用プロジェクトを作成
2. SQL Editor で `supabase-setup.sql` を実行
3. 管理画面から空き枠を登録

## 確認 URL

- 予約: https://skill-monetize-school.vercel.app/booking.html
- 管理: https://skill-monetize-school.vercel.app/admin.html

## トラブルシュート

- **カレンダーが読み込めない** → `SUPABASE_URL` / `SUPABASE_ANON_KEY` 未設定
- **管理画面ログイン後にエラー** → `ADMIN_PASSWORD` 不一致、または Supabase キー未設定
- **枠追加できない** → `supabase-setup.sql` の RLS ポリシーを再実行

環境変数変更後は Vercel で **Redeploy** が必要です。
