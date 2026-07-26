import { getDb } from "../db/index.js";

export interface Preferences {
  favoriteGenreIds: string[];
  favoriteAuthors: string[];
  businessThemes: string[];
}

const EMPTY: Preferences = { favoriteGenreIds: [], favoriteAuthors: [], businessThemes: [] };

export function getPreferences(): Preferences {
  const db = getDb();
  const row = db
    .prepare("SELECT favorite_genre_ids, favorite_authors, business_themes FROM preferences WHERE user_id = 1")
    .get() as { favorite_genre_ids: string; favorite_authors: string; business_themes: string } | undefined;
  if (!row) return EMPTY;

  return {
    favoriteGenreIds: JSON.parse(row.favorite_genre_ids),
    favoriteAuthors: JSON.parse(row.favorite_authors),
    businessThemes: JSON.parse(row.business_themes),
  };
}

export function savePreferences(prefs: Preferences): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO preferences (user_id, favorite_genre_ids, favorite_authors, business_themes, updated_at)
     VALUES (1, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       favorite_genre_ids = excluded.favorite_genre_ids,
       favorite_authors = excluded.favorite_authors,
       business_themes = excluded.business_themes,
       updated_at = datetime('now')`,
  ).run(
    JSON.stringify(prefs.favoriteGenreIds),
    JSON.stringify(prefs.favoriteAuthors),
    JSON.stringify(prefs.businessThemes),
  );
}

/** テキストエリアの入力(1行1件)を、空行を除いた配列に変換する */
export function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
