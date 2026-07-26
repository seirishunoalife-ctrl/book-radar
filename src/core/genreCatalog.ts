/**
 * 「好きなジャンル」選択用の固定ジャンル一覧。楽天ブックスAPIのジャンル検索(BooksGenre/Search)
 * で実在を確認したIDのみを採用している(2026-07時点)。全ジャンルを網羅するのではなく、
 * 個人利用で選びやすい代表的なものに絞っている。
 */
export interface GenreOption {
  id: string;
  name: string;
}

export const GENRE_CATALOG: GenreOption[] = [
  { id: "001004001", name: "ミステリー・サスペンス" },
  { id: "001004002", name: "SF・ホラー" },
  { id: "001004003", name: "エッセイ" },
  { id: "001004004", name: "ノンフィクション" },
  { id: "001004008", name: "日本の小説" },
  { id: "001004009", name: "外国の小説" },
  { id: "001004016", name: "ロマンス" },
  { id: "001006", name: "ビジネス・経済・就職(全般)" },
  { id: "001006004", name: "マーケティング・セールス" },
  { id: "001006007", name: "マネジメント・人材管理" },
  { id: "001006009", name: "自己啓発" },
  { id: "001006018", name: "経営" },
  { id: "001008", name: "人文・思想・社会" },
  { id: "001012", name: "科学・技術" },
];

export function genreNameById(id: string): string {
  return GENRE_CATALOG.find((g) => g.id === id)?.name ?? id;
}
