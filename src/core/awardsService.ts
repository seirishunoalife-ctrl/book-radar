import { getDb } from "../db/index.js";

export interface Award {
  awardName: string;
  awardYear: string | null;
  rankLabel: string | null;
  title: string;
  authorName: string | null;
}

export interface AwardEntry {
  awardName: string;
  awardYear?: string;
  rankLabel?: string;
  title: string;
  authorName?: string;
}

export function addAward(entry: AwardEntry): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO awards (award_name, award_year, rank_label, title, author_name) VALUES (?, ?, ?, ?, ?)`,
  ).run(entry.awardName, entry.awardYear ?? null, entry.rankLabel ?? null, entry.title, entry.authorName ?? null);
}

export function listAwards(): Award[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT award_name, award_year, rank_label, title, author_name FROM awards ORDER BY id DESC`)
    .all() as { award_name: string; award_year: string | null; rank_label: string | null; title: string; author_name: string | null }[];
  return rows.map((r) => ({
    awardName: r.award_name,
    awardYear: r.award_year,
    rankLabel: r.rank_label,
    title: r.title,
    authorName: r.author_name,
  }));
}

/** タイトルの表記ゆれ(全角/半角スペース、記号など)を吸収するための簡易正規化 */
function normalizeTitle(title: string): string {
  return title
    .replace(/[『』「」【】\s　]/g, "")
    .replace(/[―ー–—]/g, "-")
    .toLowerCase();
}

/**
 * 楽天ブックスAPIの検索結果タイトルが、登録済み受賞作リストと一致するか判定する。
 * 完全一致ではなく正規化した上での部分一致(どちらかがどちらかを含む)で判定する
 * (副題の有無・記号違いなどの表記ゆれを吸収するため)。
 */
export function findMatchingAward(title: string): Award | null {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;

  for (const award of listAwards()) {
    const awardNormalized = normalizeTitle(award.title);
    if (!awardNormalized) continue;
    if (normalized.includes(awardNormalized) || awardNormalized.includes(normalized)) {
      return award;
    }
  }
  return null;
}
