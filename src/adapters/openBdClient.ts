import type { BookInfo, BookMetadataProvider } from "./bookMetadataProvider.js";

const OPENBD_GET_URL = "https://api.openbd.jp/v1/get";

interface OpenBdSummary {
  isbn: string;
  title: string;
  volume: string;
  series: string;
  publisher: string;
  pubdate: string;
  cover: string;
  author: string;
}

interface OpenBdEntry {
  summary: OpenBdSummary;
}

/** openBD(https://openbd.jp/) はAPIキー不要・ISBN検索専用。楽天ブックスに無い書籍の補完用途で使う */
export class OpenBdClient implements BookMetadataProvider {
  async fetchByIsbn(isbn: string): Promise<BookInfo | null> {
    const url = new URL(OPENBD_GET_URL);
    url.searchParams.set("isbn", isbn);

    const res = await fetch(url, {
      headers: { "User-Agent": "book-radar/0.1 (personal use; book metadata lookup)" },
    });
    if (!res.ok) {
      throw new Error(`openBD API request failed: HTTP ${res.status}`);
    }

    const [entry] = (await res.json()) as (OpenBdEntry | null)[];
    if (!entry) return null;

    return toBookInfo(entry.summary);
  }
}

function toBookInfo(summary: OpenBdSummary): BookInfo {
  return {
    isbn13: summary.isbn,
    title: summary.title,
    authorName: summary.author || null,
    seriesName: summary.series || null,
    publisher: summary.publisher || null,
    releaseDate: summary.pubdate || null,
    coverImageUrl: summary.cover || null,
    rakutenItemUrl: null,
    source: "openbd",
  };
}
