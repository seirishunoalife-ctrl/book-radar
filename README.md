# book-radar

お気に入り作家の新刊が「宇部市立図書館(本館 / 学びの森くすのき)に入荷したタイミング」を通知するための個人開発アプリです。
「本屋の発売日」ではなく「自分の図書館に入った日」を知ることが目的です。

詳しい経緯・設計は以下のドキュメントを参照してください。

- [library-app-handoff.md](./library-app-handoff.md) — アプリ全体の目的・MVPスコープ・DB設計
- [opac-research-findings.md](./opac-research-findings.md) — 宇部市立図書館OPAC/カーリルAPIの実機調査結果
- [book-metadata-research.md](./book-metadata-research.md) — 書誌情報API(楽天ブックス/openBD)の比較

## 現状の機能(MVP・CLIベース)

- ISBNを指定して、宇部市立図書館(本館/学びの森くすのき)の貸出状況を取得(カーリルAPI経由)
- ISBNから書誌情報(タイトル・著者・出版社・発売日・表紙画像)を取得(楽天ブックスAPI優先、openBDを補完)
- タイトルの一部入力による書籍検索(楽天ブックスAPI)
- 取得結果はSQLiteに保存(貸出状況の変化履歴も記録)

まだ作家登録・新刊自動検知・Webフロントエンド・定期バッチ実行は未実装です。

## 使用技術

- Node.js (v24) / TypeScript
- `node:sqlite`(Node組み込み。ネイティブビルド不要)
- 外部API: [カーリル(Calil) Check API](https://calil.jp/doc/api.html)、[楽天ブックス書籍検索API](https://webservice.rakuten.co.jp/documentation/books-book-search)、[openBD](https://openbd.jp/)

## セットアップ

```bash
npm install
```

`.env` に以下を設定してください(`.env`はgit管理対象外です)。

```
CALIL_APPKEY=カーリルのアプリケーションキー
RAKUTEN_APP_ID=楽天ウェブサービスのアプリケーションID
```

## 使い方

```bash
# ISBNを指定して書誌情報・貸出状況を取得
npm run check-isbn -- <ISBN> [タイトル(書誌情報が見つからない場合の代替表示)]

# タイトルの一部で書籍を検索(楽天ブックスAPIが必要)
npm run search-title -- <タイトルの一部>
```
