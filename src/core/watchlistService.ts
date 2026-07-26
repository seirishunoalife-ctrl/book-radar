import { getDb } from "../db/index.js";
import { checkBook } from "./checkBook.js";
import { getHoldingsForBooks, type BookHolding } from "./bookHoldings.js";

export interface WatchlistBook {
  bookId: number;
  isbn13: string;
  title: string;
  releaseDate: string | null;
  coverImageUrl: string | null;
  note: string | null;
  holdings: BookHolding[];
}

/**
 * 本をウォッチリストに追加する。作家登録とは別に、個別の本を単体で追跡するための機能。
 * 既にDBに書誌情報がある本(一覧・詳細ページで一度でも表示済みの本)は、楽天API/カーリルAPIへの
 * 再アクセスをせず、既存のbookIdをそのまま使う(登録操作は保存だけの軽い処理にするため)。
 * DBに無い本(検索結果から直接登録した初回のみ)はcheckBookで新規取得する。
 */
export async function addToWatchlist(isbn: string): Promise<{ bookId: number }> {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM books WHERE isbn13 = ?").get(isbn) as { id: number } | undefined;
  const bookId = existing ? existing.id : (await checkBook(isbn)).bookId;

  db.prepare("INSERT OR IGNORE INTO watchlist (book_id) VALUES (?)").run(bookId);
  return { bookId };
}

export function removeFromWatchlist(bookId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM watchlist WHERE book_id = ?").run(bookId);
}

export function isInWatchlist(bookId: number): boolean {
  const db = getDb();
  return db.prepare("SELECT 1 FROM watchlist WHERE book_id = ?").get(bookId) !== undefined;
}

/** 気になる本の備考欄(メモ)を更新する。空文字はNULLとして保存する。 */
export function updateWatchlistNote(bookId: number, note: string): void {
  const db = getDb();
  db.prepare("UPDATE watchlist SET note = ? WHERE book_id = ?").run(note.trim() || null, bookId);
}

/** ウォッチリストに追加した順(新しい順)に本を取得する */
export function listWatchlist(): WatchlistBook[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.id, b.isbn13, b.title, b.release_date, b.cover_image_url, w.note
       FROM watchlist w
       JOIN books b ON b.id = w.book_id
       ORDER BY w.created_at DESC`,
    )
    .all() as {
    id: number;
    isbn13: string;
    title: string;
    release_date: string | null;
    cover_image_url: string | null;
    note: string | null;
  }[];

  const holdingsByBook = getHoldingsForBooks(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    bookId: row.id,
    isbn13: row.isbn13,
    title: row.title,
    releaseDate: row.release_date,
    coverImageUrl: row.cover_image_url,
    note: row.note,
    holdings: holdingsByBook.get(row.id) ?? [],
  }));
}
