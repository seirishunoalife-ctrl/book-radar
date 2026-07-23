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
  changed_at TEXT DEFAULT (datetime('now'))
);
