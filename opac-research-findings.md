# 宇部市立図書館OPAC 実機調査結果(Step5)

調査日: 2026-07-22
調査方法: `curl`によるHTTPリクエスト再現(Cookieセッション維持、UA明示)

対象: `https://seek.city.ube.yamaguchi.jp/WebOpac/webopac/`

-----

## 1. robots.txt

- `https://seek.city.ube.yamaguchi.jp/robots.txt` → **404 Not Found**(ファイル自体が存在しない)
- 明示的なDisallow指定は無い。ただし引き継ぎドキュメント記載の方針(低頻度アクセス・User-Agent明示)は robots.txt の有無に関わらず徹底する。

## 2. 画面構成・URL

| ページ | URL |
|---|---|
| トップ(PC版) | `index.do` (JSから `index.do?clear=1&target=adult` に遷移し、成人/こども向けをセッションに設定) |
| トップ(スマホ版) | `WebOpac/spopac/index.do`(別UI。今回は未調査) |
| 詳しく探す(詳細検索) | `selectsearch.do?searchkbn=2&histnum=1` |
| 検索実行 | `searchinput.do` (POST共通) |

## 3. 検索フォームの構造

### 簡易検索(トップページ、`keyword`のみ)

```html
<form name="searchinput" action="searchinput.do" method="post" onsubmit="return search();">
  <input type="hidden" name="searching" value="0">
  <input type="hidden" name="menukbn" value="0">
  <input type="hidden" name="subkbn" value="0">
  <input type="hidden" name="histname" value="">
  <input type="hidden" name="histnum" value="1">
  <input type="hidden" name="count" value="10">
  <input type="hidden" name="bkskbn" value="">
  <input type="hidden" name="btskbn" value="">
  <input type="hidden" name="bkskbnHdn" value="">
  <input type="hidden" name="btskbnHdn" value="">
  <input type="hidden" name="bkskbnRange" value="">
  <input type="hidden" name="btskbnRange" value="">
  <input type="hidden" id="authorid" name="authorid" value="">
  <input type="text" id="keyword" name="keyword" value="">
</form>
```
※「タイトルと内容説明に含まれるキーワード」検索であり、著者名は対象外(著者検索は別フィールド)。

### 詳細検索(`selectsearch.do?searchkbn=2`、ISBN検索を含む)

```html
<form name="searchinput" action="searchinput.do" method="post" onsubmit="return search();">
  <input type="hidden" name="searching" value="0">
  <input type="hidden" name="menukbn" value="0">
  <input type="hidden" name="subkbn" value="2">
  <input type="hidden" name="histname" value="">
  <input type="hidden" name="histnum" value="2">
  <input type="hidden" name="bkskbn" value="">
  <input type="hidden" name="btskbn" value="">
  <input type="hidden" name="bkskbnHdn" value="">
  <input type="hidden" name="btskbnHdn" value="">
  <input type="hidden" id="authorid" name="authorid" value="">
  <input type="hidden" id="publishid" name="publishid" value="">
  <input type="hidden" id="kenmeiid" name="kenmeiid" value="">
  <input name="keyword" id="keyword" type="text">
  <input name="title" id="title" type="text">
  <input name="author" id="author" type="text" onChange="clearAuthorId();">
  <input name="publish" id="publish" type="text" onChange="clearPublishId();">
  <input name="isbn" id="isbn" class="iw10" type="text">   <!-- ISBN検索フィールド -->
  <input name="kenmei" id="kenmei" type="text" onChange="clearKenmeiId();">
  <input name="bunruicode" id="bunruicode" type="text">
  <input name="prize" id="prize" type="text">

  <!-- 対象館の絞り込みチェックボックス(重要) -->
  <input name="kan" id="kan1" type="checkbox" value="10"> 本館
  <input name="kan" id="kan2" type="checkbox" value="30"> くすのき
</form>
```

**重要な発見**: 「本館」「くすのき」の絞り込みは `name="kan"` のチェックボックス(値: `10`=本館, `30`=くすのき)で行う。DB設計の`library_branches.opac_branch_code`にはこの`10`/`30`をそのまま格納すればよい。

## 4. 未解決の問題(要追加調査): 単純なHTTP再現では検索が機能しない

`curl`でCookieセッションを維持しつつ上記フォームのhidden fieldをすべて再現してPOSTしたところ、以下のいずれのケースでも**常に同一の「検索結果なし」ページ**(バイト単位で同一)が返った:

- 簡易検索でキーワード「夏目漱石」
- 詳細検索で著者名「夏目漱石」
- 詳細検索で実在する書籍の正しいISBN(`9784041040203`)を指定、`kan=10&kan=30`も送信

`index.do`が生成する`index.do?clear=1&target=adult`遷移も再現済みで、これも結果に影響しなかった。

**考えられる原因**:
- ページ読み込み時にJSが動的にhidden fieldへ値をセットしている(静的HTMLには現れない)可能性
- Solr連携(`lics-solr.js`が読み込まれている)によるオートコンプリート選択が前提で、素のフォーム送信だけでは検索条件が成立しない可能性
- セッション側で何らかの追加状態(Cookie以外)を要求している可能性

これは引き継ぎドキュメントの事前予測(「JS実行を伴う場合はヘッドレスブラウザが必要になる可能性あり」)が的中したと考えられる。**素のHTTPクライアント(curl/fetch)では検索を再現できず、Playwright等のヘッドレスブラウザで実ブラウザ挙動を再現する必要がある。**

## 5. 次のアクション(2026-07-22時点、下記6章の結果により更新)

- ~~`UbeLibraryAdapter`の実装はPlaywright前提で設計する~~ → **カーリル(Calil)APIが要件を満たせると判明したため、MVPではPlaywrightは不要と判断(6章参照)**
- 本調査で`curl`によるリクエストを本番OPACサイトに対して十数回程度実行済み。OPAC直接アクセスの追加ライブテストは、カーリルAPIだけでは要件を満たせない場合の補完策としてのみ今後検討する(低頻度アクセス方針の徹底)

-----

## 6. カーリル(Calil)API調査結果(2026-07-22追加調査)

宇部市立図書館はカーリル(https://calil.jp/)に蔵書データを提供済み(systemid: `Yamaguchi_Ube`、図書館コード104469、ユーザー提供情報)。図書館側公認・無料のAPIが存在するため、自前のOPACスクレイピングより優先して検討する。

### 6.1 Check API(蔵書検索)仕様

- エンドポイント: `https://api.calil.jp/check`
- 主なパラメータ:

| パラメータ | 必須/任意 | 説明 |
|---|---|---|
| `appkey` | 必須(初回) | アプリケーションキー。`https://calil.jp/api/dashboard/` で申請・取得(要ログイン) |
| `isbn` | 必須 | ISBN。カンマ区切りで複数指定可 |
| `systemid` | 必須 | 図書館システムID。カンマ区切りで複数指定可(例: `Yamaguchi_Ube`) |
| `format` | 任意 | `json`(デフォルト)/`xml` |
| `callback` | 任意 | JSONP用コールバック関数名 |
| `session` | 2回目以降必須 | 1回目のレスポンスで返る`session`文字列。2回目以降は`appkey`不要、`session`のみで再ポーリング可 |

### 6.2 レスポンス構造

```json
{
  "session": "11a285036112525afe32b1a3d4c36245",
  "books": {
    "9784041040203": {
      "Yamaguchi_Ube": {
        "status": "OK",
        "reserveurl": "https://seek.city.ube.yamaguchi.jp/....",
        "libkey": {
          "本館": "貸出中",
          "くすのき": "蔵書あり"
        }
      }
    }
  },
  "continue": 0
}
```

- `status`: `OK`(完了) / `Cache`(キャッシュ利用、OK相当) / `Running`(検索中、要ポーリング継続) / `Error`
- `libkey`: **分館ごとの貸出状況がオブジェクトのキー・値として直接返る**(本館/くすのきを区別できる、まさに今回必要な情報)
- 貸出状況の値の例: 「貸出可」「蔵書あり」「館内のみ」「貸出中」「予約中」「準備中」「休館中」「蔵書なし」など(図書館システム固有の値もあり得る)
- `reserveurl`: 予約ページへの直リンク(蔵書なしの場合は空文字)。MVP要件「予約ページへのリンクでよい」を満たす

### 6.2.1 実機確認結果(appkey取得後、2026-07-22実施 ✅確定)

`systemid=Yamaguchi_Ube` に対して実際にCheck APIを叩いて確認した。

**注意点(ドキュメント記載と異なる実挙動)**:
- `format=json` だけを指定すると **JSONPとして返る**(`callback(...)` でラップされ、かつ非推奨の警告付き)。純粋なJSONを得るには `callback=no` を明示的に指定する必要がある。
  ```
  https://api.calil.jp/check?appkey=...&isbn=...&systemid=Yamaguchi_Ube&format=json&callback=no
  ```

**テスト1: 蔵書なしのISBN(`9784041040203`)**
```json
{"session": "...", "continue": 0,
 "books": {"9784041040203": {"Yamaguchi_Ube": {"status": "OK", "libkey": {}, "reserveurl": ""}}}}
```
→ 直接OPACへの検証(4章)でも同じISBNが「検索結果なし」だったことと一致。APIが正しく機能していることの裏付けになった。

**テスト2: 蔵書ありのISBN(`9784101010137`、夏目漱石「こころ」新潮文庫)**
```json
{"session": "...", "continue": 0,
 "books": {"9784101010137": {"Yamaguchi_Ube": {
    "status": "OK",
    "libkey": {"本館": "貸出中", "学くすのき": "貸出中"},
    "reserveurl": "https://seek.city.ube.yamaguchi.jp/WebOpac/webopac/searchdetail.do?biblioid=279164#v2"
 }}}}
```

**確定した重要事項**:
- `libkey`のキー名は **`"本館"`** と **`"学くすのき"`**(「学びの森くすのき」の略。単なる「くすのき」ではない点に注意)。`library_branches.opac_branch_code`または照合ロジックはこの正確な文字列に合わせる必要がある
- `reserveurl`は特定書誌の詳細ページ(`searchdetail.do?biblioid=...`)へのURL。OPACの`biblioid`という内部IDがここで初めて確認できた
- ステータス値「貸出中」を実際に確認(貸出中/蔵書あり等の分類は6.2の一般例と一致すると見てよい)
- 1回目は`continue=1`・`status=Running`で返り、3秒待って`session`のみで再ポーリングしたところ`continue=0`・`status=OK`で確定した(仕様書の「2秒以上間隔を空ける」の目安と整合)

### 6.3 非同期ポーリングの仕組み

- 1回目: `appkey`+`isbn`+`systemid`でリクエスト → `session`と`continue`(0 or 1)が返る
- `continue=1`の間は`session`のみを付けて再リクエスト(`appkey`不要)
- ポーリング間隔: **2秒以上space**を空けること(仕様書の指示)
- 遅い図書館システムでは20秒以上かかる場合あり → バッチ処理としては許容範囲(1日1回の巡回バッチ向き)
- ポーリング自体はレート制限を消費しない(後述)

### 6.4 レート制限

- Check API: appkeyごと・IPごとに **1000書籍リクエスト/時**
- 「書籍リクエスト」=1 ISBN × 1 systemid の組み合わせ1回。ポーリングの再リクエストはカウントされない
- 1セッションにつき最大100書籍リクエストまで
- MVP規模(お気に入り作家数冊 × 1 systemid)なら余裕で収まる

### 6.5 複数ISBN・複数図書館の指定

- `isbn=A,B,C`のようにカンマ区切りで複数ISBN一括指定可能 → 巡回バッチで作家の全既知ISBNをまとめて1リクエストにできる
- `systemid`も複数指定可能(今回はUbeの1システムのみで足りる想定)

### 6.6 MVP要件との適合評価

| MVP要件 | Calil APIで対応可能か |
|---|---|
| ISBN指定での蔵書検索 | **可能**(`isbn`パラメータ) |
| 本館/くすのきを区別した貸出状況取得 | **確認済み・可能**(`libkey`のキーは`"本館"`/`"学くすのき"`。6.2.1参照) |
| 予約ページへのリンク | **可能**(`reserveurl`) |
| 巡回バッチ(1日1回)としての実行 | **適合**(ポーリング前提の設計であり、むしろOPAC直接操作よりシンプル) |
| 正当性・保守性 | **OPAC直接スクレイピングより優れる**(図書館側がデータ提供している公認API。HTML構造変化の影響を受けない) |

### 6.7 結論・方針転換

**カーリルAPIを`UbeLibraryAdapter`の実装方式として採用する。** 前述の「OPACへの直接POSTでは検索が成立しない」問題(4章)を回避でき、かつ図書館公認のAPIであるため利用規約上のグレーゾーン(1章参照)も解消される。

`LibraryAdapter`インターフェース自体は元の設計(引き継ぎドキュメント8章)のまま維持できる。内部実装がOPACスクレイピングからCalil API呼び出しに変わるだけで、他レイヤー(DB・バッチ・画面表示)への影響はない。

Playwrightによる直接アクセスは、**Calil APIが返す情報だけでは不足する場合(例: Calilのキャッシュが古く反映が遅い、宇部市が今後Calil提供を停止する等)の補完手段**として設計だけ温存し、MVPでは実装しない。

### 6.8 未確認・次のアクション(2026-07-22、appkey取得・実機確認済みの結果を踏まえて更新)

**確認済み(完了)**:
- ✅ アプリケーションキー取得済み(`library/.env`の`CALIL_APPKEY`に保存、`.gitignore`でコミット対象外に設定済み)
- ✅ `libkey`オブジェクトの実際のキー名(`"本館"` / `"学くすのき"`)— 6.2.1参照
- ✅ ポーリングの往復(`Running`→3秒待ち→`OK`)の実動作確認
- ✅ `reserveurl`が書誌詳細ページ(`biblioid`パラメータ付き)であることを確認

**残タスク**:
1. 貸出中/予約可能/蔵書なし以外のステータス文字列(「予約中」「準備中」「休館中」など)は今回のテストでは出現していない。`LibraryStatus`型へのマッピング表は、実データで確認できた「貸出中」「(蔵書なしのため該当なし)」以外は仕様書記載の一般値から暫定マッピングし、実運用で随時追加する
2. `library_branches.opac_branch_code`には`libkey`のキー文字列(`"本館"`/`"学くすのき"`)をそのまま格納する方針とする(正規化不要、Calilのキーがそのまま安定したキーとして使えるため)
3. Step6以降(リポジトリ構成・MVP実装)で、`CalilLibraryAdapter`として`LibraryAdapter`インターフェースを実装する
