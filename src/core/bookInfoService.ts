import type { BookInfo } from "../adapters/bookMetadataProvider.js";
import { RakutenBooksClient } from "../adapters/rakutenBooksClient.js";
import { OpenBdClient } from "../adapters/openBdClient.js";

/**
 * 書誌情報取得: 楽天ブックスAPIを優先し、ヒットしない場合(未登録キー・未収録書籍)は
 * openBDにフォールバックする。詳細な比較は book-metadata-research.md を参照。
 */
export async function fetchBookInfo(isbn: string): Promise<BookInfo | null> {
  if (process.env.RAKUTEN_APP_ID) {
    const rakutenInfo = await new RakutenBooksClient().fetchByIsbn(isbn);
    if (rakutenInfo) return rakutenInfo;
  }

  return new OpenBdClient().fetchByIsbn(isbn);
}

/**
 * タイトルのキーワード検索。楽天ブックスAPIのみ対応(openBDはISBN検索専用のため)。
 * RAKUTEN_APP_ID未設定の場合は分かりやすいエラーを投げる。
 */
export async function searchBookInfoByTitle(keyword: string): Promise<BookInfo[]> {
  if (!process.env.RAKUTEN_APP_ID) {
    throw new Error(
      "タイトル検索には楽天ブックスAPIのRAKUTEN_APP_IDが必要です(library/.envに設定してください)。openBDはISBN検索のみ対応しています。",
    );
  }
  return new RakutenBooksClient().searchByTitle(keyword);
}
