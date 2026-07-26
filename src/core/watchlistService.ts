import { getDb } from "../db/index.js";
import { checkBook } from "./checkBook.js";
import { getHoldingsForBook, type BookHolding } from "./bookHoldings.js";

export interface WatchlistBook {
  bookId: number;
  isbn13: string;
  title: string;
  releaseDate: string | null;
  coverImageUrl: string | null;
  holdings: BookHolding[];
}

/**
 * 本をウォッチリストに追加する。作家登録とは別に、個別の本を単体で追跡するための機能。
 * 書誌情報・蔵書状況が未取得の場合はここで取得する(checkBookは冪等なので、既に取得済みでも
 * 最新の蔵書状況に更新される)。
 */
export async function addToWatchlist(isbn: string): Promise<{ bookId: number }> {
  const { bookId } = await checkBook(isbn);
  const db = getDb();
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

/** ウォッチリストに追加した順(新しい順)に本を取得する */
export function listWatchlist(): WatchlistBook[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.id, b.isbn13, b.title, b.release_date, b.cover_image_url
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
  }[];

  return rows.map((row) => ({
    bookId: row.id,
    isbn13: row.isbn13,
    title: row.title,
    releaseDate: row.release_date,
    coverImageUrl: row.cover_image_url,
    holdings: getHoldingsForBook(db, row.id),
  }));
}
