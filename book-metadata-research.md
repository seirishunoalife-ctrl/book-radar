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

### 3.1 未解決・要ユーザー対応(2026-07-22時点、下記4章の実機確認前の記述)

楽天ブックスAPIの利用には**アプリケーションIDの取得(Rakuten Developersでのアカウント登録)**が必要。カーリルのappkeyと同様、ログインを伴うため代行不可。取得後、`library/.env`に`RAKUTEN_APP_ID`として設定してもらう必要がある。

→ 実装はappkeyが無くても動作するように設計する(未設定時はopenBDのみで動作し、タイトル検索は「楽天APIキー未設定」の明示的なエラーメッセージを返す)。

## 4. 【重要・方針修正】楽天API認証の実機確認結果(2026-07-22)

`https://webservice.rakuten.co.jp/app/create` から実際にアプリを登録し、動作確認したところ、**当初の想定(承認不要・登録のみですぐ使える・IP制限なし)は誤りだった**ことが判明した。楽天側がAPI認証方式を刷新しており、現在は以下が必須になっている。

| 項目 | 当初の想定(誤り) | 実機確認結果(2026-07-22) |
|---|---|---|
| エンドポイントホスト | `app.rakuten.co.jp` | **`openapi.rakuten.co.jp`**(`app.rakuten.co.jp`は新形式の`applicationId`を受け付けず`wrong_parameter`エラーになる) |
| 必須パラメータ | `applicationId`のみ | **`applicationId` + `accessKey`の両方が必須**(`accessKey`が無いと`accessKey must be present`エラー) |
| `applicationId`の形式 | 長い数字列 | **UUID形式**(例: `a7f70123-01a2-4663-89c1-2cc47dbe8eb1`) |
| IP制限 | なし(公開API) | **あり**。登録したアプリの許可IPアドレスに、実際にAPIを呼び出すサーバーのIPを登録する必要がある(未登録の場合 `403 CLIENT_IP_NOT_ALLOWED`) |

**再現性の確認**: 一度目に発行された認証情報でも、`https://webservice.rakuten.co.jp/app/create`から改めて新規作成した認証情報でも、**同一の`applicationId`・同じIP制限ありの挙動**になることを確認した。これはRakuten Web Service全体が新方式(IP許可リスト必須)に統合済みであり、「IP制限なしの旧方式」はもはや選べない状態と考えられる。

### 4.1 アーキテクチャへの影響

これは単なる実装の修正では済まない、**ホスティング方針そのものに関わる制約**である。楽天ブックスAPIを呼び出す実行環境(巡回バッチ・API サーバーなど)は、**固定の送信元IPアドレスを持ち、そのIPをあらかじめRakutenアプリの許可リストに登録しておく必要がある**。

これにより、Vercel/Netlify等の一般的なサーバーレスPaaS(送信元IPが動的・不定)は追加の対策なしにはそのまま使えない。対応案は以下の3つ:

1. **常時稼働の固定IP VPSでアプリ全体(バッチ+将来のAPI)を動かす**(推奨・シンプル)。Oracle Cloud Infrastructure Always Free Tierのように永年無料枠で固定IPが得られるサービスや、さくらのVPS/ConoHa VPS等の低価格国内VPSが候補
2. **静的送信元IPを提供するプロキシ経由でRakuten APIのみ呼び出す**(QuotaGuard Static等)。フロントエンド/APIは自由な構成のまま維持できるが、構成要素が増える
3. **自宅サーバー + 固定IPオプション(ISP契約変更)**。低コストではない場合が多く、可用性もISP依存

→ 上記1(固定IP VPSで一本化)が個人開発向き・低コストの原則に最も合致すると考えられるため、次のホスティング検討ではこれを軸に進める。

## 5. 実機確認成功(2026-07-23)・原因判明

検証用IP(`106.153.89.185`)を許可リストに追加したにもかかわらず何度も`CLIENT_IP_NOT_ALLOWED`が続いたが、原因は**Rakutenダッシュボードに同名(「book radar」)のアプリが2つ存在し、IPを追加していたのが`.env`の`RAKUTEN_APP_ID`(`a7f70123-01a2-4663-89c1-2cc47dbe8eb1`)とは別のアプリID(`5fcdae94-9203-40b5-966d-a67805ab73b9`)だったため**。正しい方のアプリにIPを追加したところ即座に解消した。

**教訓**: 楽天ウェブサービスの登録操作を複数回試みると、アプリケーションURLが同じでも別アプリとして重複登録されることがある。設定変更時は「アプリ名」ではなく「アプリケーションID」で対象アプリを特定すること。

### 5.1 実装バグの発見・修正

実データでの検証により、`formatVersion=2`のレスポンス構造が公式ドキュメントの一般例と異なることが判明した。

- ドキュメント上の一般例: `{"items": [{...}]}` (小文字`items`)
- **実際のレスポンス(2026-07-23確認)**: `{"Items": [{...フィールドが直接...}]}` (**大文字始まりの`Items`**)

`src/adapters/rakutenBooksClient.ts`は`data.Items ?? data.items ?? []`で両対応するよう修正済み。

### 5.2 実データ確認結果

`npm run check-isbn -- 9784101010137` で以下を確認:
- タイトル「こころ」、著者「夏目 漱石」、出版社「新潮社」、発売日「2004年03月」
- 表紙画像URL(200x200): `https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/0137/9784101010137.jpg?_ex=200x200`
- `metadata_source: 'rakuten'`としてDBに保存済み

`npm run search-title -- "こころ"` でタイトル部分一致検索も正常動作(10件ヒット、表紙画像・ISBN・著者付きで一覧表示)。

書誌情報連携(楽天ブックスAPI優先・openBDフォールバック・タイトル曖昧検索)は実データで動作確認済み。残る課題はホスティング(4.1章)のみ。
