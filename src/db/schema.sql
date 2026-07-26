CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  name TEXT NOT NULL,
  rakuten_search_keyword TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  author_id INTEGER REFERENCES authors(id),
  isbn13 TEXT,
  title TEXT NOT NULL,
  author_name TEXT,
  series_name TEXT,
  publisher TEXT,
  release_date TEXT,
  cover_image_url TEXT,
  rakuten_item_url TEXT,
  item_caption TEXT,
  /** 楽天ブックスAPIのbooksGenreId(複数分類は"/"区切りでそのまま保持。おすすめ機能の集計に使う) */
  books_genre_id TEXT,
  metadata_source TEXT,
  metadata_fetched_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn13);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);

CREATE TABLE IF NOT EXISTS libraries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  adapter_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS library_branches (
  id INTEGER PRIMARY KEY,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  name TEXT NOT NULL,
  opac_branch_code TEXT
);

CREATE TABLE IF NOT EXISTS library_holdings (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  branch_id INTEGER NOT NULL REFERENCES library_branches(id),
  status TEXT NOT NULL DEFAULT '未確認',
  opac_reserve_url TEXT,
  checked_at TEXT,
  UNIQUE(book_id, branch_id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY,
  holding_id INTEGER NOT NULL REFERENCES library_holdings(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TEXT DEFAULT (datetime('now')),
  -- 入荷通知メールを送信済みならタイムスタンプが入る(同じ変化を二重送信しないためのフラグ)
  notified_at TEXT
);

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(book_id)
);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  -- 以下4つはJSON配列文字列(例: ["001004001","001006"])として保持する
  favorite_genre_ids TEXT NOT NULL DEFAULT '[]',
  favorite_authors TEXT NOT NULL DEFAULT '[]',
  business_themes TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id)
);

-- 「更新する」ボタンを押した時点のおすすめ結果をキャッシュする(ページ表示のたびにAPIを叩かないため)
CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY,
  isbn13 TEXT NOT NULL,
  title TEXT NOT NULL,
  author_name TEXT,
  release_date TEXT,
  cover_image_url TEXT,
  item_caption TEXT,
  rakuten_item_url TEXT,
  reason TEXT,
  category TEXT NOT NULL DEFAULT 'fiction',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 受賞作品の手動登録リスト(楽天ブックスAPIに受賞情報が無いため)。
-- 新しい受賞発表があった際に、npm run add-award で随時追加していく想定。
CREATE TABLE IF NOT EXISTS awards (
  id INTEGER PRIMARY KEY,
  award_name TEXT NOT NULL,
  award_year TEXT,
  rank_label TEXT,
  title TEXT NOT NULL,
  author_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(award_name, title)
);
