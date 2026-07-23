# 書誌情報連携 API比較(楽天ブックスAPI vs openBD)

調査日: 2026-07-22

## 1. 比較サマリー

| 項目 | 楽天ブックス書籍検索API | openBD |
|---|---|---|
| エンドポイント | `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404` | `https://api.openbd.jp/v1/get?isbn=...` |
| 検索方法 | **ISBN検索・タイトル検索・著者名検索・出版社検索**(いずれか1つ以上必須) | **ISBNのみ**(カンマ区切りで複数指定可)。タイトル/著者名での検索は不可 |
| 表紙画像 | **あり**(`smallImageUrl`64x64 / `mediumImageUrl`128x128 / `largeImageUrl`200x200、いずれもhttps) | `summary.cover`フィールドはあるが**多くの書籍で空文字**(実機確認: 新潮文庫「こころ」で空)。出版社が用意していない場合は取得不可 |
| 取得できる主な情報 | title, titleKana, subTitle, seriesName, author, authorKana, publisherName, isbn, itemCaption(内容紹介), salesDate, itemPrice, itemUrl, availability, reviewCount, reviewAverage, chirayomiUrl 等 | isbn, title, volume, series, publisher, pubdate, cover, author(ローマ字表記なし、"姓,名,生没年"形式の1文字列)。加えて`hanmoto`オブジェクトに書評掲載情報等の付加データ |
| 網羅性 | 楽天ブックスで販売されている書籍のみ(比較的新しい書籍が中心) | JPO(出版情報登録センター)登録データが中心。実機確認したところ**比較的新しい書籍(コンビニ人間 `9784041040203`)がヒットしないケースもあった**一方、"こころ"のような古典は取得できた |
| 利用登録 | **要**: Rakuten Developersでアカウント作成の上、アプリケーションIDを自己発行(承認待ちなし、即時発行)。加えてアプリ側では`applicationId`パラメータのみ必須(アフィリエイトIDは任意) | **不要**(APIキーなし、誰でも即座に呼び出し可能。実機確認済み) |
| レート制限 | 公式ドキュメントに具体的な数値の記載なし。上限超過時は`HTTP 429`が返る旨の記載のみ | 明記なし。「書誌情報1件あたり1ミリ秒以下で応答」と高速性のみ言及。データの改変禁止・販促目的限定などの利用条件あり |
| レスポンス形式 | JSON/XML(`formatVersion=2`推奨) | JSON固定。ISBNごとに配列要素を返し、該当なしは`null`(実機確認済み: `[null]`) |

## 2. 実機確認結果(openBD、appkey不要のためすぐ検証可能)

```
GET https://api.openbd.jp/v1/get?isbn=9784101010137  (夏目漱石「こころ」)
→ summary: {isbn, title:"こころ", volume:"", series:"新潮文庫", publisher:"新潮社",
            pubdate:"200403", cover:"", author:"夏目,漱石,1867-1916"}
  ※ cover は空文字(表紙画像なし)

GET https://api.openbd.jp/v1/get?isbn=9784041040203  (コンビニ人間)
→ [null]  (openBDに登録なし、ヒットしない)
```

## 3. 結論・採用方針

引き継ぎドキュメント(5章)の当初決定どおり、**楽天ブックスAPIを書誌情報取得の主軸とする**。理由:

1. 本アプリの目的である「表紙表示」「タイトル検索(曖昧検索の第一歩)」の両方は、**楽天ブックスAPIでなければ実現できない**(openBDはISBN検索専用かつ表紙画像がほぼ空)
2. 楽天ブックスAPIのタイトル検索(`title`パラメータ)はキーワード的な部分一致検索であり、追加実装なしでそのまま「タイトルの一部入力での曖昧検索」の要件を満たせる

**openBDは補完として、以下の場合にフォールバック的に使う**:
- 楽天ブックスに登録されていない書籍(絶版・古い書籍など)のISBN検索時
- 将来的に書評・関連情報(`hanmoto`)を追加したくなった場合

### 3.1 未解決・要ユーザー対応

楽天ブックスAPIの利用には**アプリケーションIDの取得(Rakuten Developersでのアカウント登録)**が必要。カーリルのappkeyと同様、ログインを伴うため代行不可。取得後、`library/.env`に`RAKUTEN_APP_ID`として設定してもらう必要がある。

→ 実装はappkeyが無くても動作するように設計する(未設定時はopenBDのみで動作し、タイトル検索は「楽天APIキー未設定」の明示的なエラーメッセージを返す)。
