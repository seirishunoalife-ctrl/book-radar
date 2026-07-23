import { getDb } from "../db/index.js";
import { getAuthorByName, type Author } from "./authorService.js";

export interface BookHolding {
  branchName: string;
  statusLabel: string;
  reserveUrl: string | null;
}

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
}

/** カーリルAPI由来の生ステータス文字列を、本棚ビュー向けの分かりやすいラベルに変換する */
function toStatusLabel(rawStatus: string): string {
  switch (rawStatus) {
    case "蔵書なし":
      return "未入荷";
    case "貸出中":
      return "貸出中";
    case "貸出可":
    case "蔵書あり":
    case "館内のみ":
      return "入荷済み(貸出可)";
    case "予約中":
      return "予約中";
    case "準備中":
      return "準備中";
    case "休館中":
      return "休館中";
    default:
      return rawStatus;
  }
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

  const books: AuthorBook[] = bookRows.map((row) => {
    const holdingRows = db
      .prepare(
        `SELECT lb.name as branch_name, lh.status, lh.opac_reserve_url
         FROM library_holdings lh
         JOIN library_branches lb ON lb.id = lh.branch_id
         WHERE lh.book_id = ?
         ORDER BY lb.id`,
      )
      .all(row.id) as { branch_name: string; status: string; opac_reserve_url: string | null }[];

    const isHeldSomewhere = holdingRows.some((h) => h.status !== "蔵書なし");
    const holdings: BookHolding[] = isHeldSomewhere
      ? holdingRows.map((h) => ({
          branchName: h.branch_name,
          statusLabel: toStatusLabel(h.status),
          reserveUrl: h.opac_reserve_url,
        }))
      : [];

    return {
      isbn13: row.isbn13,
      title: row.title,
      releaseDate: row.release_date,
      coverImageUrl: row.cover_image_url,
      holdings,
    };
  });

  return { author, books };
}
