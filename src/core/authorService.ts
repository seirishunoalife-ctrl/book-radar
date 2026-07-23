import { getDb } from "../db/index.js";

export interface Author {
  id: number;
  name: string;
  rakutenSearchKeyword: string | null;
}

/**
 * 作家を登録する。同名の作家が既に登録済みの場合は既存のものを返す(重複登録しない)。
 */
export function addAuthor(name: string, rakutenSearchKeyword?: string): Author {
  const db = getDb();
  const existing = getAuthorByName(name);
  if (existing) return existing;

  const result = db
    .prepare("INSERT INTO authors (name, rakuten_search_keyword) VALUES (?, ?)")
    .run(name, rakutenSearchKeyword ?? null);
  return { id: Number(result.lastInsertRowid), name, rakutenSearchKeyword: rakutenSearchKeyword ?? null };
}

export function listAuthors(): Author[] {
  const db = getDb();
  const rows = db.prepare("SELECT id, name, rakuten_search_keyword FROM authors ORDER BY id").all() as {
    id: number;
    name: string;
    rakuten_search_keyword: string | null;
  }[];
  return rows.map((row) => ({ id: row.id, name: row.name, rakutenSearchKeyword: row.rakuten_search_keyword }));
}

export function getAuthorByName(name: string): Author | undefined {
  const db = getDb();
  const row = db.prepare("SELECT id, name, rakuten_search_keyword FROM authors WHERE name = ?").get(name) as
    | { id: number; name: string; rakuten_search_keyword: string | null }
    | undefined;
  if (!row) return undefined;
  return { id: row.id, name: row.name, rakutenSearchKeyword: row.rakuten_search_keyword };
}
