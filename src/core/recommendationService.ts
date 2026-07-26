import { getDb } from "../db/index.js";
import { getPreferences } from "./preferencesService.js";
import { searchBookInfoForRecommendation } from "./bookInfoService.js";
import {
  GENRE_CATALOG,
  genreNameById,
  genreCategoryById,
  categorizeByGenreId,
  type RecommendationCategory,
} from "./genreCatalog.js";
import { findMatchingAward } from "./awardsService.js";
import type { BookInfo } from "../adapters/bookMetadataProvider.js";

export interface RecommendedBook {
  isbn13: string;
  title: string;
  authorName: string | null;
  releaseDate: string | null;
  coverImageUrl: string | null;
  itemCaption: string | null;
  rakutenItemUrl: string | null;
  reason: string;
  category: RecommendationCategory;
}

const MAX_PER_CATEGORY = 8;
const FREQUENT_GENRE_LIMIT = 3;
const FREQUENT_AUTHOR_LIMIT = 3;
// 検索元(ジャンル/作家/テーマ/備考)の数だけ楽天APIへの逐次リクエストが発生し、
// 1回あたり最低1.1秒のスロットルがかかる(rakutenBooksClient側のレート制限対策)。
// 「更新する」の体感速度を優先し、検索元の数は絞った上でHITS_PER_SOURCEを増やして
// 候補の多様性を維持する。
const MAX_GENRES = 4;
const MAX_AUTHORS = 4;
const MAX_THEMES = 2;
const MAX_NOTES = 2;
const HITS_PER_SOURCE = 15;
const MAX_PAGE_FOR_VARIETY = 3;
const RECENT_WITHIN_DAYS = 90;

// 同一プロセス内での楽天APIへの全リクエストがrakutenBooksClient側でスロットル・リトライ
// されるため、ここでは特に追加の間隔制御はしない(呼び出し元は直列にawaitするだけでよい)。

function randomPage(pageCount: number): number {
  const max = Math.min(pageCount, MAX_PAGE_FOR_VARIETY);
  return Math.floor(Math.random() * max) + 1;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** "2026年09月17日頃" 等の表記から年月日を緩く読み取る。パースできなければnull。 */
function parseReleaseDate(text: string | null): Date | null {
  if (!text) return null;
  const m = text.match(/(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = m[3] ? Number(m[3]) : 1;
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRecent(releaseDate: string | null): boolean {
  const date = parseReleaseDate(releaseDate);
  if (!date) return false;
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= RECENT_WITHIN_DAYS && diffDays >= -30; // 少し先の予約可能な近刊も許容
}

/** 気になる本リストのジャンル・著者を集計し、頻出上位を返す(単純な出現回数カウント)。 */
function getFrequentGenreIds(limit: number): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.books_genre_id FROM watchlist w JOIN books b ON b.id = w.book_id WHERE b.books_genre_id IS NOT NULL`,
    )
    .all() as { books_genre_id: string }[];

  const counts = new Map<string, number>();
  for (const row of rows) {
    const paths = row.books_genre_id.split("/");
    for (const path of paths) {
      // キュレーション済みジャンル一覧のうち、このパスが前方一致するものをすべてカウントする
      for (const genre of GENRE_CATALOG) {
        if (path.startsWith(genre.id)) {
          counts.set(genre.id, (counts.get(genre.id) ?? 0) + 1);
        }
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

function getFrequentAuthors(limit: number): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.author_name, COUNT(*) as c FROM watchlist w JOIN books b ON b.id = w.book_id
       WHERE b.author_name IS NOT NULL AND b.author_name != ''
       GROUP BY b.author_name ORDER BY c DESC LIMIT ?`,
    )
    .all(limit) as { author_name: string; c: number }[];
  return rows.map((r) => r.author_name);
}

function getWatchlistIsbns(): Set<string> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT b.isbn13 FROM watchlist w JOIN books b ON b.id = w.book_id`)
    .all() as { isbn13: string }[];
  return new Set(rows.map((r) => r.isbn13));
}

interface Candidate {
  info: BookInfo;
  reason: string;
  category: RecommendationCategory;
  /** 選出の優先度。2=受賞作一致、1=直近発売、0=それ以外(値が大きいほど優先) */
  priority: number;
}

/**
 * 好みプロフィール(事前登録)と気になる本リストの集計(履歴)を組み合わせて、
 * 楽天ブックスAPIから候補を集め、「小説・エッセイ系」「ビジネス書・実用書系」の2カテゴリに
 * 分けて選ぶ。本格的な学習は行わず、単純な集計+ルールベースの検索・優先度付けの組み合わせ。
 * 優先度: 受賞作一致 > 直近3ヶ月以内の新刊 > その他(同順位内はランダム、更新の度に変化する)。
 */
export async function generateRecommendations(): Promise<RecommendedBook[]> {
  const prefs = getPreferences();
  const frequentGenreIds = getFrequentGenreIds(FREQUENT_GENRE_LIMIT);
  const frequentAuthors = getFrequentAuthors(FREQUENT_AUTHOR_LIMIT);

  const genreIds = [...new Set([...prefs.favoriteGenreIds, ...frequentGenreIds])].slice(0, MAX_GENRES);
  const authors = [...new Set([...prefs.favoriteAuthors, ...frequentAuthors])].slice(0, MAX_AUTHORS);
  const themes = prefs.businessThemes.slice(0, MAX_THEMES);
  const notes = prefs.notes.slice(0, MAX_NOTES);

  if (genreIds.length === 0 && authors.length === 0 && themes.length === 0 && notes.length === 0) {
    setCachedRecommendations([]);
    return [];
  }

  const candidates: Candidate[] = [];

  for (const genreId of genreIds) {
    const isFavorite = prefs.favoriteGenreIds.includes(genreId);
    const reason = `${isFavorite ? "好きなジャンル" : "よく読むジャンル"}: ${genreNameById(genreId)}`;
    await collectFromQuery({ booksGenreId: genreId }, reason, genreCategoryById(genreId), candidates);
  }
  for (const author of authors) {
    const isFavorite = prefs.favoriteAuthors.includes(author);
    const reason = `${isFavorite ? "好きな作家" : "よく読む作家"}: ${author}`;
    await collectFromQuery({ author }, reason, "fiction", candidates);
  }
  for (const theme of themes) {
    await collectFromQuery({ title: theme }, `テーマ: ${theme}`, "business", candidates);
  }
  for (const note of notes) {
    // 備考欄はジャンル・小説/ビジネス書のどちらを指しているか分からないため、検索結果の
    // 本自体が実際に属するジャンルIDからカテゴリを推定する(検索条件からは決め打ちしない)。
    await collectFromQuery({ title: note }, `備考: ${note}`, "auto", candidates);
  }

  const excludeIsbns = getWatchlistIsbns();
  const seen = new Set<string>();
  const deduped: Candidate[] = [];
  for (const candidate of shuffle(candidates)) {
    const isbn = candidate.info.isbn13;
    if (!isbn || excludeIsbns.has(isbn) || seen.has(isbn)) continue;
    seen.add(isbn);
    deduped.push(candidate);
  }

  // 優先度の高い順(同順位内はshuffle済みなのでランダム)に並べ、カテゴリごとに上限まで選ぶ
  deduped.sort((a, b) => b.priority - a.priority);

  const results: RecommendedBook[] = [];
  for (const category of ["fiction", "business"] as const) {
    const picked = deduped.filter((c) => c.category === category).slice(0, MAX_PER_CATEGORY);
    for (const c of picked) {
      results.push({
        isbn13: c.info.isbn13,
        title: c.info.title,
        authorName: c.info.authorName,
        releaseDate: c.info.releaseDate,
        coverImageUrl: c.info.coverImageUrl,
        itemCaption: c.info.itemCaption,
        rakutenItemUrl: c.info.rakutenItemUrl,
        reason: c.reason,
        category,
      });
    }
  }

  setCachedRecommendations(results);
  return results;
}

async function collectFromQuery(
  query: Record<string, string>,
  reason: string,
  category: RecommendationCategory | "auto",
  out: Candidate[],
): Promise<void> {
  try {
    const { items, pageCount } = await searchBookInfoForRecommendation(query, HITS_PER_SOURCE, 1);
    const page = randomPage(pageCount);
    const result = page === 1 ? { items } : await searchBookInfoForRecommendation(query, HITS_PER_SOURCE, page);
    for (const info of result.items) {
      if (!info.isbn13) continue;

      const award = findMatchingAward(info.title);
      const finalReason = award
        ? `受賞: ${award.awardName}${award.awardYear ? award.awardYear : ""}${award.rankLabel ? ` ${award.rankLabel}` : ""}`
        : reason;
      const priority = award ? 2 : isRecent(info.releaseDate) ? 1 : 0;
      const resolvedCategory = category === "auto" ? categorizeByGenreId(info.genreId) : category;

      out.push({ info, reason: finalReason, category: resolvedCategory, priority });
    }
  } catch (error) {
    console.error(`おすすめ本の検索に失敗しました(条件: ${JSON.stringify(query)}):`, error instanceof Error ? error.message : error);
  }
}

function setCachedRecommendations(results: RecommendedBook[]): void {
  const db = getDb();
  db.exec("DELETE FROM recommendations");
  const stmt = db.prepare(
    `INSERT INTO recommendations (isbn13, title, author_name, release_date, cover_image_url, item_caption, rakuten_item_url, reason, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of results) {
    stmt.run(
      r.isbn13,
      r.title,
      r.authorName,
      r.releaseDate,
      r.coverImageUrl,
      r.itemCaption,
      r.rakutenItemUrl,
      r.reason,
      r.category,
    );
  }
}

export function getCachedRecommendations(): RecommendedBook[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT isbn13, title, author_name, release_date, cover_image_url, item_caption, rakuten_item_url, reason, category
       FROM recommendations ORDER BY id`,
    )
    .all() as {
    isbn13: string;
    title: string;
    author_name: string | null;
    release_date: string | null;
    cover_image_url: string | null;
    item_caption: string | null;
    rakuten_item_url: string | null;
    reason: string | null;
    category: string;
  }[];

  return rows.map((r) => ({
    isbn13: r.isbn13,
    title: r.title,
    authorName: r.author_name,
    releaseDate: r.release_date,
    coverImageUrl: r.cover_image_url,
    itemCaption: r.item_caption,
    rakutenItemUrl: r.rakuten_item_url,
    reason: r.reason ?? "",
    category: r.category === "business" ? "business" : "fiction",
  }));
}
