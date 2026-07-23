import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db/index.js";
import { listAuthors, type Author } from "./authorService.js";
import { searchBookInfoByAuthorPage } from "./bookInfoService.js";
import { checkBook, type CheckBookResult } from "./checkBook.js";
import type { BookInfo } from "../adapters/bookMetadataProvider.js";

// 楽天ブックスAPIへの連続リクエストを避けるための最小間隔
const REQUEST_INTERVAL_MS = 1000;

// 1人の作家につき最大で何ページ(30件/ページ)まで遡るかの安全上限。
// 発売日の新しい順に辿って「DB既知の本」に当たった時点で打ち切るため、通常はここまで
// 到達しない。極端に多作な作家(150冊超)の場合のみ、この上限より古い本は取り込まれない。
const MAX_PAGES = 5;

export interface AuthorNewReleaseResult {
  author: Author;
  newReleases: CheckBookResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定した作家について、楽天ブックスAPIの著者名検索(発売日の新しい順)をページを辿りながら
 * 検索し、DBに未登録のISBN(=新刊候補)を検出する。新しい順に辿っているため、DB既知の本に
 * 当たった時点でそれ以降(=より古い本)は既に把握済みとみなして打ち切る。
 * これにより、初回登録時は深く遡って取り込みつつ、2回目以降は通常1ページで完了する。
 */
async function findNewReleaseCandidates(author: Author): Promise<BookInfo[]> {
  const db = getDb();
  const keyword = author.rakutenSearchKeyword ?? author.name;
  const candidates: BookInfo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(REQUEST_INTERVAL_MS);

    const result = await searchBookInfoByAuthorPage(keyword, page);
    let reachedKnownBook = false;

    for (const item of result.items) {
      if (item.isbn13 && bookExists(db, item.isbn13)) {
        reachedKnownBook = true;
        break;
      }
      candidates.push(item);
    }

    if (reachedKnownBook || page >= result.pageCount) break;
  }

  return candidates;
}

/**
 * 指定した作家の新刊候補を検出し、書誌情報・図書館蔵書状況を取得してDBに保存する。
 * 「新刊」の判定は発売日ではなく「DBに存在するかどうか」のみで行う(初回登録時は既刊も
 * すべて新刊候補として検出される)。
 */
export async function checkNewReleasesForAuthor(author: Author): Promise<AuthorNewReleaseResult> {
  const candidates = await findNewReleaseCandidates(author);

  const newReleases: CheckBookResult[] = [];
  for (const candidate of candidates) {
    if (!candidate.isbn13) continue;

    await sleep(REQUEST_INTERVAL_MS);
    newReleases.push(await checkBook(candidate.isbn13, { authorId: author.id }));
  }

  return { author, newReleases };
}

/**
 * 登録済みの全作家について新刊チェックを実行する。1人の作家でエラーが起きても
 * 他の作家のチェックは継続する。
 */
export async function checkNewReleasesForAllAuthors(): Promise<AuthorNewReleaseResult[]> {
  const authors = listAuthors();
  const results: AuthorNewReleaseResult[] = [];

  for (const author of authors) {
    try {
      results.push(await checkNewReleasesForAuthor(author));
    } catch (error) {
      console.error(`「${author.name}」の新刊チェックに失敗しました:`, error instanceof Error ? error.message : error);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  return results;
}

function bookExists(db: DatabaseSync, isbn: string): boolean {
  return db.prepare("SELECT 1 FROM books WHERE isbn13 = ?").get(isbn) !== undefined;
}
