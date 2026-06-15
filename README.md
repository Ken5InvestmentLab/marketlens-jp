# MarketLens JP

日本株の適時開示、決算予定、市場イベントをスマホとPCで確認する無料・広告なしのPWAです。Cloudflare Workersで静的フロントとAPIプロキシを同時配信します。

## 機能

- TDnet適時開示フィード: 検索、カテゴリ、重要度、未読、ウォッチ銘柄フィルタ
- 実データAPI: `/api/disclosures` がTDnet公開ページを取得してアプリ用JSONへ正規化
- 市場カレンダー: `/api/calendar` がJPX市場休日を返却
- J-Quants連携: `JQUANTS_API_KEY` を設定すると決算予定、取引カレンダー、TDnet add-on APIを優先利用
- ウォッチリスト: 4桁数字コードと英字入りコードに対応、ローカル保存
- PWA: スマホホーム画面追加、静的ファイルのオフラインキャッシュ
- ICS書き出し: 市場イベントをカレンダーアプリへ取り込み

## ローカル起動

```powershell
npm install
npm run dev
```

表示先:

```text
http://localhost:8787
```

## チェック

```powershell
npm run test:parser
npm run check
```

## データAPI

```text
GET /api/disclosures?date=2026-06-15&days=3&limit=120
GET /api/calendar?from=2026-06-15&days=90
GET /api/status
```

`/api/disclosures` は `source=tdnet-public` を指定するとTDnet公開ページのみを使います。`JQUANTS_API_KEY` が設定されている場合は、既定でJ-Quants TDnet APIを優先し、失敗時にTDnet公開ページへ戻します。

## J-Quants APIキー

キーはソースに書かず、Cloudflare secretとして設定します。

```powershell
npx wrangler secret put JQUANTS_API_KEY
```

J-Quants API V2は `x-api-key` ヘッダーを使います。無料プランのレート制限や、TDnet add-onの契約範囲に注意してください。

## 公開配布

Cloudflareにログイン済みなら次で公開できます。

```powershell
npm run deploy
```

GitHub連携で自動デプロイする場合は、このフォルダをGitHubリポジトリにpushし、Cloudflare WorkersのGit連携またはGitHub Actionsから `npm run deploy` を実行します。

## 参考データ源

- TDnet公開閲覧サービス: https://www.release.tdnet.info/
- TDnet API: https://www.jpx.co.jp/markets/paid-info-listing/tdnet/02.html
- J-Quants API: https://www.jpx.co.jp/english/markets/other-data-services/j-quants-api/index.html
- J-Quants V2移行情報: https://jpx-jquants.com/en/spec/migration-v1-v2
- JPX市場休日: https://www.jpx.co.jp/english/corporate/about-jpx/calendar/
- JPX国内株式取引時間: https://www.jpx.co.jp/english/equities/trading/domestic/01.html

投資判断は自己責任です。重要な情報はTDnet、JPX、各社IRなど一次情報で確認してください。
