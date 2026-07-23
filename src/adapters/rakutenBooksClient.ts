import type { BookInfo, TitleSearchableProvider } from "./bookMetadataProvider.js";

// 2026-07時点の実機確認により、app.rakuten.co.jp は新方式のapplicationIdを受け付けない。
// openapi.rakuten.co.jp が正しいホストで、applicationIdに加えてaccessKeyの送信とIP許可リスト登録が必須。
const SEARCH_URL = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";

interface RakutenBookItem {
  title: string;
  titleKana?: string;
  subTitle?: string;
  seriesName?: string;
  author?: string;
  authorKana?: string;
  publisherName?: string;
  isbn?: string;
  itemCaption?: string;
  salesDate?: string;
  itemUrl?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
}

interface RakutenSearchResponse {
  count: number;
  pageCount: number;
  // 実機確認(2026-07-23): formatVersion=2でも配列キーは "Items"(大文字始まり)で返り、
  // 各要素はItemでラップされずフィールドが直接載る形式だった。
  Items?: RakutenBookItem[];
  items?: (RakutenBookItem | { Item: RakutenBookItem })[];
}

export interface AuthorSearchPage {
  items: BookInfo[];
  page: number;
  pageCount: number;
}

/**
 * 楽天ブックス書籍検索API(https://webservice.rakuten.co.jp/documentation/books-book-search)。
 * ISBN検索・タイトル検索(部分一致的なキーワード検索)の両方に対応。表紙画像・著者名・
 * タイトル検索が必要な本アプリでは、こちらを書誌情報取得の主軸として使う。
 */
export class RakutenBooksClient implements TitleSearchableProvider {
  constructor(
    private readonly applicationId: string = mustGetEnv("RAKUTEN_APP_ID"),
    private readonly accessKey: string = mustGetEnv("RAKUTEN_APP_SECRET"),
  ) {}

  async fetchByIsbn(isbn: string): Promise<BookInfo | null> {
    const { items } = await this.search({ isbn });
    if (items.length === 0) return null;
    return toBookInfo(items[0]);
  }

  async searchByTitle(keyword: string): Promise<BookInfo[]> {
    const { items } = await this.search({ title: keyword });
    return items.map(toBookInfo);
  }

  /**
   * 著者名で1ページ分(最大30件)検索する(新刊検知用)。発売日の新しい順(sort=-releaseDate)に
   * 固定しているため、呼び出し側は新しい順にページを辿り、DB既知の本に当たった時点で
   * 打ち切ることで「新刊の見落とし無し」と「無駄なページ取得を避ける」を両立できる。
   * マッチングは楽天側の検索に任せ、こちらでの表記ゆれ吸収(あいまい一致)は行わない。
   */
  async searchByAuthorPage(name: string, page: number): Promise<AuthorSearchPage> {
    const { items, pageCount } = await this.search({ author: name, sort: "-releaseDate" }, 30, page);
    return { items: items.map(toBookInfo), page, pageCount };
  }

  private async search(
    query: Record<string, string>,
    hits = 10,
    page = 1,
  ): Promise<{ items: RakutenBookItem[]; pageCount: number }> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("applicationId", this.applicationId);
    url.searchParams.set("accessKey", this.accessKey);
    url.searchParams.set("formatVersion", "2");
    url.searchParams.set("hits", String(hits));
    url.searchParams.set("page", String(page));
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "book-radar/0.1 (personal use; book metadata lookup)" },
    });
    if (res.status === 429) {
      throw new Error("楽天ブックスAPIのレート制限を超えました。しばらく待って再試行してください。");
    }
    if (res.status === 403) {
      const body = await res.text();
      if (body.includes("CLIENT_IP_NOT_ALLOWED")) {
        throw new Error(
          "楽天APIがこのIPアドレスからのアクセスを許可していません。Rakuten Developersダッシュボードのアプリ設定でIP許可リストにこの実行環境のIPを追加してください。",
        );
      }
      throw new Error(`楽天ブックスAPIリクエストが拒否されました: HTTP 403 ${body}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`楽天ブックスAPIリクエストに失敗しました: HTTP ${res.status} ${body}`);
    }

    const data = (await res.json()) as RakutenSearchResponse;
    const entries = data.Items ?? data.items ?? [];
    const items = entries.map((entry) => ("Item" in entry ? entry.Item : entry));
    return { items, pageCount: data.pageCount ?? 1 };
  }
}

function toBookInfo(item: RakutenBookItem): BookInfo {
  return {
    isbn13: item.isbn ?? "",
    title: item.title,
    authorName: item.author ?? null,
    seriesName: item.seriesName ?? null,
    publisher: item.publisherName ?? null,
    releaseDate: item.salesDate ?? null,
    coverImageUrl: item.largeImageUrl || item.mediumImageUrl || item.smallImageUrl || null,
    rakutenItemUrl: item.itemUrl ?? null,
    source: "rakuten",
  };
}

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (check library/.env)`);
  }
  return value;
}
