import type { BookInfo, TitleSearchableProvider } from "./bookMetadataProvider.js";

const SEARCH_URL = "https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404";

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
  items: (RakutenBookItem | { Item: RakutenBookItem })[];
}

/**
 * 楽天ブックス書籍検索API(https://webservice.rakuten.co.jp/documentation/books-book-search)。
 * ISBN検索・タイトル検索(部分一致的なキーワード検索)の両方に対応。表紙画像・著者名・
 * タイトル検索が必要な本アプリでは、こちらを書誌情報取得の主軸として使う。
 */
export class RakutenBooksClient implements TitleSearchableProvider {
  constructor(private readonly applicationId: string = mustGetApplicationId()) {}

  async fetchByIsbn(isbn: string): Promise<BookInfo | null> {
    const items = await this.search({ isbn });
    if (items.length === 0) return null;
    return toBookInfo(items[0]);
  }

  async searchByTitle(keyword: string): Promise<BookInfo[]> {
    const items = await this.search({ title: keyword });
    return items.map(toBookInfo);
  }

  private async search(query: Record<string, string>): Promise<RakutenBookItem[]> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("applicationId", this.applicationId);
    url.searchParams.set("formatVersion", "2");
    url.searchParams.set("hits", "10");
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "book-radar/0.1 (personal use; book metadata lookup)" },
    });
    if (res.status === 429) {
      throw new Error("楽天ブックスAPIのレート制限を超えました。しばらく待って再試行してください。");
    }
    if (!res.ok) {
      throw new Error(`楽天ブックスAPIリクエストに失敗しました: HTTP ${res.status}`);
    }

    const data = (await res.json()) as RakutenSearchResponse;
    return data.items.map((entry) => ("Item" in entry ? entry.Item : entry));
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

function mustGetApplicationId(): string {
  const id = process.env.RAKUTEN_APP_ID;
  if (!id) {
    throw new Error("RAKUTEN_APP_ID is not set (check library/.env)");
  }
  return id;
}
