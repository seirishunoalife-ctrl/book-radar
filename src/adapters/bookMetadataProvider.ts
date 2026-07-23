export type MetadataSource = "rakuten" | "openbd";

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
  source: MetadataSource;
}

export interface BookMetadataProvider {
  fetchByIsbn(isbn: string): Promise<BookInfo | null>;
}

export interface TitleSearchableProvider extends BookMetadataProvider {
  searchByTitle(keyword: string): Promise<BookInfo[]>;
}
