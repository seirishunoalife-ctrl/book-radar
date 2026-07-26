import { getDb } from "../db/index.js";
import { getAuthorByName, type Author } from "./authorService.js";
import { getHoldingsForBook, type BookHolding } from "./bookHoldings.js";

export interface AuthorBook {
  isbn13: string;
  title: string;
  releaseDate: string | null;
  coverImageUrl: string | null;
  /** 全分館とも「蔵書なし」の場合は空配列(未入荷として扱う) */
  holdings: BookHolding[];
}

export interface AuthorBooksResult {
  author: Author;
  books: AuthorBook[];
  limit: number;
}

/**
 * 作家名を指定して、DBに登録済みのその作家の本を発売日の新しい順に取得する(本棚ビュー用)。
 * check-new-releases が裏側でDBを最新化するバッチ処理であるのに対し、こちらは
 * 保存済みデータを読むだけの表示用ビュー。
 */
export function getAuthorBooks(authorName: string, limit = 10): AuthorBooksResult {
  const author = getAuthorByName(authorName);
  if (!author) {
    throw new Error(`作家「${authorName}」は未登録です。npm run add-author -- ${authorName} で登録してください。`);
  }

  const db = getDb();
  const bookRows = db
    .prepare(
      `SELECT id, isbn13, title, release_date, cover_image_url
       FROM books
       WHERE author_id = ?
       ORDER BY release_date DESC
       LIMIT ?`,
    )
    .all(author.id, limit) as {
    id: number;
    isbn13: string;
    title: string;
    release_date: string | null;
    cover_image_url: string | null;
  }[];

  const books: AuthorBook[] = bookRows.map((row) => ({
    isbn13: row.isbn13,
    title: row.title,
    releaseDate: row.release_date,
    coverImageUrl: row.cover_image_url,
    holdings: getHoldingsForBook(db, row.id),
  }));

  return { author, books, limit };
}
