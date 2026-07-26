import { getDb } from "../db/index.js";

export interface Preferences {
  favoriteGenreIds: string[];
  favoriteAuthors: string[];
  businessThemes: string[];
  /** おすすめ本生成の参考にする自由記述の備考(1行1件、タイトルキーワード検索の材料として使う) */
  notes: string[];
}

const EMPTY: Preferences = { favoriteGenreIds: [], favoriteAuthors: [], businessThemes: [], notes: [] };

export function getPreferences(): Preferences {
  const db = getDb();
  const row = db
    .prepare("SELECT favorite_genre_ids, favorite_authors, business_themes, notes FROM preferences WHERE user_id = 1")
    .get() as
    | { favorite_genre_ids: string; favorite_authors: string; business_themes: string; notes: string | null }
    | undefined;
  if (!row) return EMPTY;

  return {
    favoriteGenreIds: JSON.parse(row.favorite_genre_ids),
    favoriteAuthors: JSON.parse(row.favorite_authors),
    businessThemes: JSON.parse(row.business_themes),
    notes: row.notes ? JSON.parse(row.notes) : [],
  };
}

export function savePreferences(prefs: Preferences): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO preferences (user_id, favorite_genre_ids, favorite_authors, business_themes, notes, updated_at)
     VALUES (1, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       favorite_genre_ids = excluded.favorite_genre_ids,
       favorite_authors = excluded.favorite_authors,
       business_themes = excluded.business_themes,
       notes = excluded.notes,
       updated_at = datetime('now')`,
  ).run(
    JSON.stringify(prefs.favoriteGenreIds),
    JSON.stringify(prefs.favoriteAuthors),
    JSON.stringify(prefs.businessThemes),
    JSON.stringify(prefs.notes),
  );
}

/** テキストエリアの入力(1行1件)を、空行を除いた配列に変換する */
export function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
