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
  const holdingRows = db
    .prepare(
      `SELECT lb.name as branch_name, lh.status, lh.opac_reserve_url
       FROM library_holdings lh
       JOIN library_branches lb ON lb.id = lh.branch_id
       WHERE lh.book_id = ?
       ORDER BY lb.id`,
    )
    .all(bookId) as { branch_name: string; status: string; opac_reserve_url: string | null }[];

  const isHeldSomewhere = holdingRows.some((h) => h.status !== "蔵書なし");
  if (!isHeldSomewhere) return [];

  return holdingRows.map((h) => ({
    branchName: h.branch_name,
    statusLabel: toStatusLabel(h.status),
    reserveUrl: h.opac_reserve_url,
  }));
}
