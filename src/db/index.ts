import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH ?? join(__dirname, "..", "..", "data", "book-radar.db");

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;

  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);

  migrate(db);
  seed(db);

  return db;
}

/**
 * schema.sqlのCREATE TABLE IF NOT EXISTSは既存テーブルへの列追加を反映しないため、
 * 後から追加したカラムはここでALTER TABLEする(簡易マイグレーション)。
 */
function migrate(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(books)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "item_caption")) {
    db.exec("ALTER TABLE books ADD COLUMN item_caption TEXT");
  }
  if (!columns.some((c) => c.name === "books_genre_id")) {
    db.exec("ALTER TABLE books ADD COLUMN books_genre_id TEXT");
  }
}

function seed(db: DatabaseSync): void {
  db.exec(`INSERT OR IGNORE INTO users (id, display_name) VALUES (1, 'default')`);
  db.exec(`INSERT OR IGNORE INTO libraries (id, name, adapter_key) VALUES (1, '宇部市立図書館', 'ube')`);
  db.exec(`
    INSERT OR IGNORE INTO library_branches (id, library_id, name, opac_branch_code) VALUES
      (1, 1, '本館', '本館'),
      (2, 1, '学びの森くすのき', '学くすのき')
  `);
}
