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

  const watchlistColumns = db.prepare("PRAGMA table_info(watchlist)").all() as { name: string }[];
  if (!watchlistColumns.some((c) => c.name === "note")) {
    db.exec("ALTER TABLE watchlist ADD COLUMN note TEXT");
  }

  const recommendationColumns = db.prepare("PRAGMA table_info(recommendations)").all() as { name: string }[];
  if (!recommendationColumns.some((c) => c.name === "category")) {
    db.exec("ALTER TABLE recommendations ADD COLUMN category TEXT NOT NULL DEFAULT 'fiction'");
  }

  const preferencesColumns = db.prepare("PRAGMA table_info(preferences)").all() as { name: string }[];
  if (!preferencesColumns.some((c) => c.name === "notes")) {
    db.exec("ALTER TABLE preferences ADD COLUMN notes TEXT NOT NULL DEFAULT '[]'");
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
  seedAwards(db);
}

/**
 * 受賞作品の初期データ(2026-07時点でWeb検索により確認)。楽天ブックスAPIには受賞情報が
 * 無いため手動登録方式を採用している。新しい受賞発表があれば `npm run add-award` で追加する。
 * UNIQUE(award_name, title)によりINSERT OR IGNOREで何度再実行しても重複しない。
 */
function seedAwards(db: DatabaseSync): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO awards (award_name, award_year, rank_label, title, author_name) VALUES (?, ?, ?, ?, ?)`,
  );
  const entries: [string, string, string, string, string][] = [
    ["本屋大賞", "2026", "大賞", "イン・ザ・メガチャーチ", "朝井リョウ"],
    ["本屋大賞", "2026", "2位", "熟柿", "佐藤正午"],
    ["本屋大賞", "2026", "3位", "PRIZE―プライズ―", "村山由佳"],
    ["本屋大賞", "2026", "4位", "エピクロスの処方箋", "夏川草介"],
    ["本屋大賞", "2026", "5位", "暁星", "湊かなえ"],
    ["本屋大賞", "2026", "6位", "殺し屋の営業術", "野宮有"],
    ["本屋大賞", "2026", "7位", "ありか", "瀬尾まいこ"],
    ["本屋大賞", "2026", "8位", "探偵小石は恋しない", "森バジル"],
    ["本屋大賞", "2026", "9位", "失われた貌", "櫻田智也"],
    ["本屋大賞", "2026", "10位", "さよならジャバウォック", "伊坂幸太郎"],
    ["直木賞", "2026(第175回)", "受賞", "けんぐゎい", "朝倉かすみ"],
    ["本格ミステリ大賞", "2026(第26回)", "受賞", "夜と霧の誘拐", "笠井潔"],
    ["本格ミステリ大賞", "2026(第26回)", "次点", "神の光", "北山猛邦"],
    ["本格ミステリ大賞", "2026(第26回)", "次点", "探偵機械エキシマ", "松城明"],
  ];
  for (const entry of entries) stmt.run(...entry);
}
