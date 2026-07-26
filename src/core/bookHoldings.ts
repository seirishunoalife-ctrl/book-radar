import type { DatabaseSync } from "node:sqlite";

export interface BookHolding {
  branchName: string;
  statusLabel: string;
  reserveUrl: string | null;
}

/** カーリルAPI由来の生ステータス文字列を、画面向けの分かりやすいラベルに変換する */
export function toStatusLabel(rawStatus: string): string {
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

/** 指定した本の分館ごとの蔵書状況を取得する。全分館「蔵書なし」の場合は空配列(未入荷として扱う)。 */
export function getHoldingsForBook(db: DatabaseSync, bookId: number): BookHolding[] {
  return getHoldingsForBooks(db, [bookId]).get(bookId) ?? [];
}

/**
 * 複数の本の蔵書状況をまとめて1クエリで取得する(一覧表示での1冊ずつのN+1クエリを回避)。
 * bookIdごとの結果はMapで返す(該当データが無いbookIdは空配列)。
 */
export function getHoldingsForBooks(db: DatabaseSync, bookIds: number[]): Map<number, BookHolding[]> {
  const result = new Map<number, BookHolding[]>();
  if (bookIds.length === 0) return result;

  const placeholders = bookIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT lh.book_id as book_id, lb.name as branch_name, lh.status, lh.opac_reserve_url
       FROM library_holdings lh
       JOIN library_branches lb ON lb.id = lh.branch_id
       WHERE lh.book_id IN (${placeholders})
       ORDER BY lh.book_id, lb.id`,
    )
    .all(...bookIds) as { book_id: number; branch_name: string; status: string; opac_reserve_url: string | null }[];

  const byBook = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byBook.get(row.book_id);
    if (list) list.push(row);
    else byBook.set(row.book_id, [row]);
  }

  for (const bookId of bookIds) {
    const holdingRows = byBook.get(bookId) ?? [];
    const isHeldSomewhere = holdingRows.some((h) => h.status !== "蔵書なし");
    result.set(
      bookId,
      isHeldSomewhere
        ? holdingRows.map((h) => ({
            branchName: h.branch_name,
            statusLabel: toStatusLabel(h.status),
            reserveUrl: h.opac_reserve_url,
          }))
        : [],
    );
  }
  return result;
}
