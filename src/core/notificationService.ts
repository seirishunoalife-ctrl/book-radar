import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db/index.js";
import { checkBook } from "./checkBook.js";
import { sendNotificationEmail } from "../adapters/emailClient.js";

// 楽天ブックスAPI/カーリルAPIへの連続リクエストを避けるための最小間隔(他のバッチ処理と統一)
const REQUEST_INTERVAL_MS = 1000;

const NOT_HELD_STATUS = "蔵書なし";
const LOAN_STATUS = "貸出中";
const AVAILABLE_STATUSES = ["貸出可", "蔵書あり", "館内のみ"];

const WEB_URL = process.env.WEB_URL || "https://book-radar.tail20f6f1.ts.net";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ArrivalKind = "new_arrival" | "returned";

export interface ArrivalNotice {
  historyId: number;
  isbn13: string;
  title: string;
  branchName: string;
  /** new_arrival: 未入荷から新しく入荷、returned: 貸出中から返却されて借りられるようになった */
  kind: ArrivalKind;
}

export interface RefreshResult {
  checked: number;
  notified: ArrivalNotice[];
  /** 通知対象はあったがメール送信自体に失敗した場合true(次回実行時に再送を試みる) */
  sendFailed: boolean;
}

/**
 * 気になる本リストの全ての本について、蔵書状況を再取得(checkBook経由でDBも更新される)し、
 * 入荷済み(貸出可)に変わった本があれば1通のメールにまとめて通知する。以下の2パターンを
 * 区別する: 「未入荷→入荷済み」(新しく図書館に並んだ)と「貸出中→入荷済み」(返却された)。
 * 通知済みのstatus_history行にはnotified_atを記録し、二重送信を防ぐ。
 */
export async function refreshWatchlistAndNotify(): Promise<RefreshResult> {
  const db = getDb();
  const isbnRows = db
    .prepare(`SELECT DISTINCT b.isbn13 FROM watchlist w JOIN books b ON b.id = w.book_id`)
    .all() as { isbn13: string }[];

  let checked = 0;
  for (const { isbn13 } of isbnRows) {
    if (checked > 0) await sleep(REQUEST_INTERVAL_MS);
    try {
      await checkBook(isbn13);
    } catch (error) {
      console.error(
        `「${isbn13}」の蔵書状況再取得に失敗しました:`,
        error instanceof Error ? error.message : error,
      );
    }
    checked++;
  }

  const notices = findUnnotifiedArrivals(db);
  if (notices.length > 0) {
    try {
      await sendArrivalEmail(notices);
      markNotified(db, notices);
    } catch (error) {
      // 送信に失敗した場合はnotified_atを更新しない(次回実行時に再送を試みる)
      console.error("入荷通知メールの送信に失敗しました:", error instanceof Error ? error.message : error);
      return { checked, notified: [], sendFailed: true };
    }
  }

  return { checked, notified: notices, sendFailed: false };
}

function findUnnotifiedArrivals(db: DatabaseSync): ArrivalNotice[] {
  const oldStatuses = [NOT_HELD_STATUS, LOAN_STATUS];
  const oldPlaceholders = oldStatuses.map(() => "?").join(",");
  const availablePlaceholders = AVAILABLE_STATUSES.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT sh.id as history_id, b.isbn13, b.title, lb.name as branch_name, sh.old_status
       FROM status_history sh
       JOIN library_holdings lh ON lh.id = sh.holding_id
       JOIN books b ON b.id = lh.book_id
       JOIN library_branches lb ON lb.id = lh.branch_id
       JOIN watchlist w ON w.book_id = b.id
       WHERE sh.notified_at IS NULL
         AND sh.old_status IN (${oldPlaceholders})
         AND sh.new_status IN (${availablePlaceholders})
       ORDER BY sh.changed_at`,
    )
    .all(...oldStatuses, ...AVAILABLE_STATUSES) as {
    history_id: number;
    isbn13: string;
    title: string;
    branch_name: string;
    old_status: string;
  }[];

  // 「未入荷→入荷済み」(new_arrival)を優先し、その中・「貸出中→入荷済み」(returned)の中は
  // それぞれ変化した順(古い順)で並べる
  const notices = rows.map((r) => ({
    historyId: r.history_id,
    isbn13: r.isbn13,
    title: r.title,
    branchName: r.branch_name,
    kind: (r.old_status === NOT_HELD_STATUS ? "new_arrival" : "returned") as ArrivalKind,
  }));
  const rank = (kind: ArrivalKind) => (kind === "new_arrival" ? 0 : 1);
  return notices.sort((a, b) => rank(a.kind) - rank(b.kind));
}

async function sendArrivalEmail(notices: ArrivalNotice[]): Promise<void> {
  const newArrivals = notices.filter((n) => n.kind === "new_arrival");
  const returned = notices.filter((n) => n.kind === "returned");

  const sections: string[] = [];
  if (newArrivals.length > 0) {
    sections.push(
      `■ 新しく図書館に並びました(${newArrivals.length}冊)\n` +
        newArrivals.map((n) => `・${n.title}(${n.branchName})`).join("\n"),
    );
  }
  if (returned.length > 0) {
    sections.push(
      `■ 返却されて借りられるようになりました(${returned.length}冊)\n` +
        returned.map((n) => `・${n.title}(${n.branchName})`).join("\n"),
    );
  }

  const subject = `【book-radar】${notices.length}冊が入荷しました`;
  const body = `${sections.join("\n\n")}\n\n${WEB_URL} で詳細・予約リンクを確認できます。`;
  await sendNotificationEmail(subject, body);
}

function markNotified(db: DatabaseSync, notices: ArrivalNotice[]): void {
  const stmt = db.prepare(`UPDATE status_history SET notified_at = datetime('now') WHERE id = ?`);
  for (const n of notices) stmt.run(n.historyId);
}
