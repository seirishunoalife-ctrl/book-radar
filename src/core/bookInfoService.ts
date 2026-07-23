import type { BookInfo } from "../adapters/bookMetadataProvider.js";
import { RakutenBooksClient, type AuthorSearchPage } from "../adapters/rakutenBooksClient.js";
import { OpenBdClient } from "../adapters/openBdClient.js";

/**
 * 書誌情報取得: 楽天ブックスAPIを優先し、ヒットしない場合(未登録キー・未収録書籍)は
 * openBDにフォールバックする。詳細な比較は book-metadata-research.md を参照。
 */
export async function fetchBookInfo(isbn: string): Promise<BookInfo | null> {
  if (process.env.RAKUTEN_APP_ID && process.env.RAKUTEN_APP_SECRET) {
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
  return requireRakutenClient("タイトル検索").searchByTitle(keyword);
}

/**
 * 著者名検索・1ページ分(新刊検知用)。発売日の新しい順で返る。楽天ブックスAPIのみ対応。
 */
export async function searchBookInfoByAuthorPage(name: string, page: number): Promise<AuthorSearchPage> {
  return requireRakutenClient("著者名検索").searchByAuthorPage(name, page);
}

function requireRakutenClient(featureName: string): RakutenBooksClient {
  if (!process.env.RAKUTEN_APP_ID || !process.env.RAKUTEN_APP_SECRET) {
    throw new Error(
      `${featureName}には楽天ブックスAPIのRAKUTEN_APP_ID/RAKUTEN_APP_SECRETが必要です(library/.envに設定してください)。openBDはISBN検索のみ対応しています。`,
    );
  }
  return new RakutenBooksClient();
}
