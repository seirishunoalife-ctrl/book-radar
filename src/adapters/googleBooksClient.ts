import type { BookInfo, TitleSearchableProvider } from "./bookMetadataProvider.js";

const VOLUMES_URL = "https://www.googleapis.com/books/v1/volumes";

interface GoogleVolumeInfo {
  title: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: { type: string; identifier: string }[];
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
  infoLink?: string;
}

interface GoogleVolume {
  volumeInfo: GoogleVolumeInfo;
}

interface GoogleVolumesResponse {
  totalItems: number;
  items?: GoogleVolume[];
}

export interface AuthorSearchResult {
  items: BookInfo[];
  totalItems: number;
}

/**
 * Google Books API(https://developers.google.com/books/docs/v1/using)。
 * 楽天ブックスAPIとの切り替え検証用(book-metadata-research.md参照)。IP許可リスト不要・
 * APIキーのみで利用可能なためRender等の動的IP環境と相性が良い一方、和書のカバー率・
 * 表紙画質は要検証。
 */
export class GoogleBooksClient implements TitleSearchableProvider {
  constructor(private readonly apiKey: string = mustGetEnv("GOOGLE_BOOKS_API_KEY")) {}

  async fetchByIsbn(isbn: string): Promise<BookInfo | null> {
    const { items } = await this.search(`isbn:${isbn}`);
    if (items.length === 0) return null;
    return toBookInfo(items[0].volumeInfo);
  }

  async searchByTitle(keyword: string): Promise<BookInfo[]> {
    const { items } = await this.search(`intitle:${keyword}`);
    return items.map((item) => toBookInfo(item.volumeInfo));
  }

  async searchByAuthor(name: string): Promise<AuthorSearchResult> {
    const { items, totalItems } = await this.search(`inauthor:${name}`, 40);
    return { items: items.map((item) => toBookInfo(item.volumeInfo)), totalItems };
  }

  private async search(q: string, maxResults = 10): Promise<{ items: GoogleVolume[]; totalItems: number }> {
    const url = new URL(VOLUMES_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("country", "JP");
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url, {
      headers: { "User-Agent": "book-radar/0.1 (personal use; book metadata lookup)" },
    });
    if (res.status === 429) {
      throw new Error("Google Books APIのクォータを超過しました。しばらく待って再試行してください。");
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Books APIリクエストに失敗しました: HTTP ${res.status} ${body}`);
    }

    const data = (await res.json()) as GoogleVolumesResponse;
    return { items: data.items ?? [], totalItems: data.totalItems ?? 0 };
  }
}

function toBookInfo(info: GoogleVolumeInfo): BookInfo {
  const isbn13 = info.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier ?? "";
  const cover = info.imageLinks;

  return {
    isbn13,
    title: info.title,
    authorName: info.authors?.join("/") ?? null,
    seriesName: null,
    publisher: info.publisher ?? null,
    releaseDate: info.publishedDate ?? null,
    // https を強制(Google Books はデフォルトで http のURLを返すことがある)
    coverImageUrl: (cover?.large ?? cover?.medium ?? cover?.thumbnail ?? cover?.smallThumbnail ?? null)?.replace(
      /^http:/,
      "https:",
    ) ?? null,
    rakutenItemUrl: info.infoLink ?? null,
    itemCaption: info.description ?? null,
    genreId: null,
    source: "googlebooks",
  };
}

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (check library/.env)`);
  }
  return value;
}
