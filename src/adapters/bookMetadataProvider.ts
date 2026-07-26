export type MetadataSource = "rakuten" | "openbd" | "googlebooks";

export interface BookInfo {
  isbn13: string;
  title: string;
  authorName: string | null;
  seriesName: string | null;
  publisher: string | null;
  /** 表記が "YYYY年MM月DD日" 等バラバラなため正規化はせず、取得した文字列をそのまま保持する */
  releaseDate: string | null;
  coverImageUrl: string | null;
  rakutenItemUrl: string | null;
  /** あらすじ・紹介文。楽天ブックスAPIのitemCaptionのみ対応(openBDは非対応で常にnull)。 */
  itemCaption: string | null;
  /** 楽天ブックスAPIのbooksGenreId(複数分類は"/"区切り)。おすすめ機能の集計用。楽天のみ対応。 */
  genreId: string | null;
  source: MetadataSource;
}

export interface BookMetadataProvider {
  fetchByIsbn(isbn: string): Promise<BookInfo | null>;
}

export interface TitleSearchableProvider extends BookMetadataProvider {
  searchByTitle(keyword: string): Promise<BookInfo[]>;
}
