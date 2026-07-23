# 図書館入荷通知Webアプリ 開発引き継ぎドキュメント

このドキュメントは、事前の設計検討(スマホ版Claudeとの壁打ち)の結果をまとめたものです。
以降の実装(Step5〜7)はこのドキュメントを前提にClaude Codeで進めます。

-----

## 1. アプリの目的

新刊発売情報を取得し、お気に入り作家の本が「自分が利用する図書館に入荷したタイミング」を
確認できるアプリを作る。

**価値の中心**: 「本屋の発売日」ではなく「自分の図書館に入った日」を知らせること。単なる新刊管理アプリではない。

## 2. 開発方針

- 最初は個人用アプリとして作る(ユーザー登録・ログインなし)
- ただし将来的に以下を追加できる設計にする(このために最初から拡張性を意識する):
  - ユーザー登録・ログイン
  - 読書履歴保存
  - お気に入り作家保存(複数ユーザー対応)
  - 複数図書館登録・全国の図書館対応
  - 通知機能
  - 公開サービス化

## 3. 利用環境

- スマホ利用が中心。PC向けではなくスマホUIを優先。
- PWA化してホーム画面から使えるようにする。

## 4. MVPスコープ(最小実装)

ユーザー登録は不要。以下のみ実装する。

1. お気に入り作家登録(**作家単位**。シリーズ単位の管理は将来拡張)
1. 新刊情報取得
1. ISBN取得
1. 宇部市図書館(本館 + くすのき の両方)の蔵書検索
1. 状態表示:
- 発売前
- 発売済み、図書館未入荷
- 図書館所蔵あり
- 貸出中
- 予約可能

予約処理自体は不要。図書館予約ページへのリンクでよい。

-----

## 5. 検討済みの決定事項(壁打ち済み・確定)

|項目      |決定内容                                                                                         |
|--------|---------------------------------------------------------------------------------------------|
|新刊情報の取得元|**楽天ブックスAPI**(著者名検索・アプリID発行のみで利用可、登録不要)。補完として**openBD**(無料・ISBN起点の書誌詳細取得)も併用する               |
|書誌の突合方法 |**ISBN基本**。タイトル表記ゆれの吸収(あいまい一致)はMVPではやらない。ただし「発売前」段階の本は仮ISBNが後で変わる場合があるため、発売日が近づいたら再取得する処理を入れる|
|巡回方式    |**自動で毎日1回**巡回。通知機能は後日実装(MVPでは画面表示のみ)                                                         |
|対象館     |宇部市立図書館の**本館 + くすのき** 両方                                                                     |
|データ永続化  |**サーバー側DB**に保存(localStorage等のブラウザ内保存は使わない)。理由: アプリのバージョンアップやブラウザ側の都合に影響されず、お気に入り作家データを永続化するため|
|管理単位    |作家単位(シリーズ単位ではない)                                                                             |

-----

## 6. 技術調査結果(宇部市立図書館 Web OPAC)

対象: `https://seek.city.ube.yamaguchi.jp/WebOpac/webopac/`

|項目    |結果                                                                                 |
|------|-----------------------------------------------------------------------------------|
|公開API |なし。画面遷移型OPAC(.do拡張子のサーブレット形式)                                                      |
|ISBN検索|可能。「詳しく探す」(`selectsearch.do?searchkbn=2`)にISBN専用の検索欄あり                             |
|検索方式  |画面遷移はGETパラメータ中心。検索実行時のフォームaction/methodは**要実機確認**(ブラウザ開発者ツールのNetworkタブで確認すること)     |
|結果取得方法|HTMLページとして返却。JSON/XML等の構造化APIはなし                                                   |
|HTML解析|必要(スクレイピング前提)                                                                      |
|自動検索  |技術的には可能。セッションCookie維持+フォーム送信の再現が必要。JS実行を伴う場合はヘッドレスブラウザ(Playwright等)が必要になる可能性あり     |
|利用規約  |サイト上に明記されたスクレイピング可否の記載は未確認。**robots.txtの目視確認と、低頻度アクセス(1日1回程度)・User-Agent明示を徹底すること**|
|実装難易度 |中程度。API連携ではなくHTMLスクレイピングのため、サイト構造変更時の保守が発生する前提で設計する                                |

### 未確認・要実機調査(Claude Codeで最初にやるべきこと)

- 検索実行時の実際のフォームaction/method(GET/POST)
- 検索結果ページのHTML構造(スクレイピング対象のセレクタ)
- robots.txtの内容

-----

## 7. 全体アーキテクチャ

```
① フロントエンド(PWA・スマホUI)
     ↑ APIで取得
② バックエンドAPI(DBの状態を返すだけ)
     ↑ 参照
③ データベース(作家・本・所蔵状態を保存)
     ↑ 書き込み
④ 巡回バッチ(毎日1回、自動実行)
     ├─ 楽天ブックスAPI/openBDで新刊チェック
     └─ 宇部市OPACを本館・くすのき両方でISBN検索してスクレイピング
```

**設計原則**: 「巡回バッチ」と「画面表示」を完全分離する。ユーザーがアプリを開いた瞬間にスクレイピングが走るのではなく、バッチが事前にDBを更新しておき、アプリはDBを読むだけにする。
理由: 表示が高速になる / OPACへの負荷が1日1回に抑えられる(利用規約面でも安全側)。

### 状態遷移

```
発売前
 └(発売日到来)→ 発売済み・未入荷
                  └(バッチがOPACで発見)→ 所蔵あり
                                          ├→ 貸出中
                                          └→ 予約可能
```

## 8. Library Adapter設計(複数図書館対応の土台)

```ts
interface LibraryAdapter {
  searchByIsbn(isbn: string): Promise<LibraryStatus>
}

type LibraryStatus =
  | "not_yet_published"
  | "published_not_in"
  | "in_library"
  | "on_loan"
  | "reservable"
  | "unknown"

class UbeLibraryAdapter implements LibraryAdapter {
  // 宇部市立図書館固有のスクレイピングロジック(本館・くすのきの2館分)
}

// 将来: class YamaguchiLibraryAdapter implements LibraryAdapter { ... }
```

新しい図書館を追加する時は`LibraryAdapter`を実装するクラスを1つ足すだけで済む設計にする。

-----

## 9. データベース設計(確定・SQLite想定)

個人開発・低コスト・Claude Codeとの相性を優先しSQLiteを想定。将来Postgres(Supabase/Neon等)へ移行しやすいスキーマにしてある。

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
-- MVPでは id=1 の1行だけINSERTしておく

CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  name TEXT NOT NULL,
  rakuten_search_keyword TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  isbn13 TEXT,
  title TEXT NOT NULL,
  publisher TEXT,
  release_date TEXT,
  rakuten_item_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_books_isbn ON books(isbn13);
CREATE INDEX idx_books_author ON books(author_id);

CREATE TABLE libraries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  adapter_key TEXT NOT NULL UNIQUE
);

CREATE TABLE library_branches (
  id INTEGER PRIMARY KEY,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  name TEXT NOT NULL,
  opac_branch_code TEXT
);
-- 初期データ: libraries(1,"宇部市立図書館","ube")
--            library_branches(1,1,"本館",...), (2,1,"くすのき",...)

CREATE TABLE library_holdings (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  branch_id INTEGER NOT NULL REFERENCES library_branches(id),
  status TEXT NOT NULL DEFAULT '未確認',
  opac_reserve_url TEXT,
  checked_at TEXT,
  UNIQUE(book_id, branch_id)
);

CREATE TABLE status_history (
  id INTEGER PRIMARY KEY,
  holding_id INTEGER NOT NULL REFERENCES library_holdings(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TEXT DEFAULT (datetime('now'))
);
```

### 設計のポイント

- `authors.user_id` を最初から持たせているので、後でログイン機能を追加してもテーブル構造の変更が不要
- `library_branches` を独立テーブルにしたことで、本館・くすのき以外の館や将来の別図書館(山口市など)を行を増やすだけで追加できる
- `status_history` はMVPでは表示に使わないが、将来の通知機能のトリガーに転用できるよう記録だけ残す
- `books.isbn13` はUNIQUE制約なし(発売前の仮ISBNが後で変わるケースを許容するため)

-----

## 10. まだ決まっていないこと(Claude Codeでこれから決める・進める部分)

- Step4: 画面設計(スマホUI・ワイヤーフレーム)
- 技術選定: フロントエンド/バックエンド/ホスティング/将来の認証方式の具体的な組み合わせ
  (条件: 個人開発向き・低コスト・Claude Codeで開発しやすい・スマホ対応・将来拡張可能)
  ※「自動で毎日巡回」を選んだため、PWAだけでは完結せず、裏で定期実行するスケジューラ(バッチ)が必須である点を踏まえて選定すること
- Step5: 開発環境構築
- Step6: GitHubリポジトリ構成・ブランチ運用・README作成
- Step7: MVP実装

-----

## 11. Claude Codeへの依頼メッセージ(そのまま貼ってOK)

> 上記のドキュメントの内容で「図書館入荷通知Webアプリ」を開発します。
> Step4(画面設計)以降を、初心者にも分かるように説明しながら一緒に進めてください。
> まずは宇部市OPACの検索実行時の実際のフォームaction/method、結果ページのHTML構造、robots.txtの内容を実機で調査するところから始めてください。
