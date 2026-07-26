/**
 * 「好きなジャンル」選択用の固定ジャンル一覧。楽天ブックスAPIのジャンル検索(BooksGenre/Search)
 * で実在を確認したIDのみを採用している(2026-07時点)。全ジャンルを網羅するのではなく、
 * 個人利用で選びやすい代表的なものに絞っている。
 *
 * category はおすすめ本を「小説・エッセイ系」「ビジネス書・実用書系」の2セクションに
 * 分けて表示するための分類(単純な二値分類。厳密なジャンル体系ではない)。
 */
export type RecommendationCategory = "fiction" | "business";

export interface GenreOption {
  id: string;
  name: string;
  category: RecommendationCategory;
}

export const GENRE_CATALOG: GenreOption[] = [
  { id: "001004001", name: "ミステリー・サスペンス", category: "fiction" },
  { id: "001004002", name: "SF・ホラー", category: "fiction" },
  { id: "001004003", name: "エッセイ", category: "fiction" },
  { id: "001004004", name: "ノンフィクション", category: "fiction" },
  { id: "001004008", name: "日本の小説", category: "fiction" },
  { id: "001004009", name: "外国の小説", category: "fiction" },
  { id: "001004016", name: "ロマンス", category: "fiction" },
  { id: "001006", name: "ビジネス・経済・就職(全般)", category: "business" },
  { id: "001006004", name: "マーケティング・セールス", category: "business" },
  { id: "001006007", name: "マネジメント・人材管理", category: "business" },
  { id: "001006009", name: "自己啓発", category: "business" },
  { id: "001006018", name: "経営", category: "business" },
  { id: "001008", name: "人文・思想・社会", category: "fiction" },
  { id: "001012", name: "科学・技術", category: "fiction" },
];

export function genreNameById(id: string): string {
  return GENRE_CATALOG.find((g) => g.id === id)?.name ?? id;
}

export function genreCategoryById(id: string): RecommendationCategory {
  return GENRE_CATALOG.find((g) => g.id === id)?.category ?? "fiction";
}

/**
 * 楽天ブックスAPIが返す実際のbooksGenreId(複数分類は"/"区切り)から、キュレーション済み
 * ジャンル一覧に前方一致するものを探してカテゴリを推定する。一致が無ければ"fiction"扱い。
 * 検索条件だけからはカテゴリが分からない場合(例: 備考欄の自由記述検索)に使う。
 */
export function categorizeByGenreId(booksGenreId: string | null): RecommendationCategory {
  if (!booksGenreId) return "fiction";
  const paths = booksGenreId.split("/");
  for (const path of paths) {
    for (const genre of GENRE_CATALOG) {
      if (path.startsWith(genre.id)) return genre.category;
    }
  }
  return "fiction";
}
