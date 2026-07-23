import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db/index.js";
import type { LibraryAdapter, BranchHolding } from "../adapters/libraryAdapter.js";
import { CalilLibraryAdapter } from "../adapters/calilLibraryAdapter.js";
import type { BookInfo } from "../adapters/bookMetadataProvider.js";
import { fetchBookInfo } from "./bookInfoService.js";

const NOT_HELD_STATUS = "蔵書なし";

export interface CheckBookResult {
  isbn: string;
  bookId: number;
  bookInfo: BookInfo | null;
  holdings: BranchHolding[];
}

/**
 * ISBNを指定して書誌情報(楽天ブックスAPI/openBD)と図書館の蔵書状況(カーリルAPI)を取得し、
 * DBに保存する(book-radarのコアループ)。
 * 蔵書が無い場合(holdingsが空)は、登録済みの全分館に対して「蔵書なし」を記録する。
 */
export async function checkBook(
  isbn: string,
  options: { title?: string; adapter?: LibraryAdapter } = {},
): Promise<CheckBookResult> {
  const db = getDb();
  const adapter = options.adapter ?? new CalilLibraryAdapter();

  const [bookInfo, holdings] = await Promise.all([fetchBookInfo(isbn), adapter.searchByIsbn(isbn)]);
  const bookId = upsertBook(db, isbn, bookInfo, options.title);

  if (holdings.length === 0) {
    for (const branch of getAllBranches(db)) {
      upsertHolding(db, bookId, branch.id, NOT_HELD_STATUS, null);
    }
  } else {
    for (const holding of holdings) {
      const branch = findBranchByCode(db, holding.branchCode);
      if (!branch) {
        console.warn(`未登録の分館コードです(library_branchesに追加してください): ${holding.branchCode}`);
        continue;
      }
      upsertHolding(db, bookId, branch.id, holding.status ?? "未確認", holding.reserveUrl);
    }
  }

  return { isbn, bookId, bookInfo, holdings };
}

function upsertBook(
  db: DatabaseSync,
  isbn: string,
  bookInfo: BookInfo | null,
  titleOverride: string | undefined,
): number {
  const title = bookInfo?.title ?? titleOverride ?? `(タイトル未取得: ${isbn})`;
  const existing = db.prepare("SELECT id FROM books WHERE isbn13 = ?").get(isbn) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE books SET
         title = ?, author_name = ?, series_name = ?, publisher = ?, release_date = ?,
         cover_image_url = ?, rakuten_item_url = ?, metadata_source = ?, metadata_fetched_at = datetime('now')
       WHERE id = ?`,
    ).run(
      title,
      bookInfo?.authorName ?? null,
      bookInfo?.seriesName ?? null,
      bookInfo?.publisher ?? null,
      bookInfo?.releaseDate ?? null,
      bookInfo?.coverImageUrl ?? null,
      bookInfo?.rakutenItemUrl ?? null,
      bookInfo?.source ?? null,
      existing.id,
    );
    return existing.id;
  }

  const result = db
    .prepare(
      `INSERT INTO books
         (isbn13, title, author_name, series_name, publisher, release_date, cover_image_url, rakuten_item_url, metadata_source, metadata_fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      isbn,
      title,
      bookInfo?.authorName ?? null,
      bookInfo?.seriesName ?? null,
      bookInfo?.publisher ?? null,
      bookInfo?.releaseDate ?? null,
      bookInfo?.coverImageUrl ?? null,
      bookInfo?.rakutenItemUrl ?? null,
      bookInfo?.source ?? null,
    );
  return Number(result.lastInsertRowid);
}

function getAllBranches(db: DatabaseSync): { id: number; opac_branch_code: string }[] {
  return db.prepare("SELECT id, opac_branch_code FROM library_branches").all() as {
    id: number;
    opac_branch_code: string;
  }[];
}

function findBranchByCode(db: DatabaseSync, branchCode: string): { id: number } | undefined {
  return db.prepare("SELECT id FROM library_branches WHERE opac_branch_code = ?").get(branchCode) as
    | { id: number }
    | undefined;
}

function upsertHolding(
  db: DatabaseSync,
  bookId: number,
  branchId: number,
  newStatus: string,
  reserveUrl: string | null,
): void {
  const existing = db
    .prepare("SELECT id, status FROM library_holdings WHERE book_id = ? AND branch_id = ?")
    .get(bookId, branchId) as { id: number; status: string } | undefined;

  if (!existing) {
    const result = db
      .prepare(
        "INSERT INTO library_holdings (book_id, branch_id, status, opac_reserve_url, checked_at) VALUES (?, ?, ?, ?, datetime('now'))",
      )
      .run(bookId, branchId, newStatus, reserveUrl);
    db.prepare(
      "INSERT INTO status_history (holding_id, old_status, new_status) VALUES (?, NULL, ?)",
    ).run(Number(result.lastInsertRowid), newStatus);
    return;
  }

  db.prepare(
    "UPDATE library_holdings SET status = ?, opac_reserve_url = ?, checked_at = datetime('now') WHERE id = ?",
  ).run(newStatus, reserveUrl, existing.id);

  if (existing.status !== newStatus) {
    db.prepare(
      "INSERT INTO status_history (holding_id, old_status, new_status) VALUES (?, ?, ?)",
    ).run(existing.id, existing.status, newStatus);
  }
}
