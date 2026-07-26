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
  /** あらすじ・紹介文 */
  itemCaption?: string;
  salesDate?: string;
  itemUrl?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  booksGenreId?: string;
  reviewCount?: number;
  /** 実機確認では文字列("4.17"等)で返る */
  reviewAverage?: string;
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
  /** 検索条件に一致した総件数(全ページ合計) */
  count: number;
}

export interface TitleSearchPage {
  items: BookInfo[];
  /** 今回のリクエストで指定した件数上限(本棚ビューのlimitと同じ考え方) */
  hits: number;
  count: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 同一プロセス内(Webサーバー/CLI)からの楽天APIへの全リクエストに適用する最小間隔。
// 作家登録時のバックグラウンド新刊チェックと、フォアグラウンドでの検索操作が同時に
// 走った場合でも、リクエストが重ならないようにするためのグローバルなスロットル。
const MIN_REQUEST_INTERVAL_MS = 1100;
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

// レート制限(429)に対する簡易リトライ。初回+2回まで再試行(合計最大3回)し、
// それでも失敗する場合のみユーザーにエラーを表示する。
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

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
   * タイトル検索を指定件数まで取得する(「もっと見る」によるページング用)。本棚ビューの
   * limitと同様、件数を増やして再検索する方式(page切り替えではなく累積表示)。
   * 楽天API側のhits上限(30)を超えないようにする。
   */
  async searchByTitleWithHits(keyword: string, hits: number): Promise<TitleSearchPage> {
    const cappedHits = Math.min(hits, 30);
    const { items, count } = await this.search({ title: keyword }, cappedHits, 1);
    return { items: items.map(toBookInfo), hits: cappedHits, count };
  }

  /**
   * 著者名で1ページ分(最大30件)検索する(新刊検知用)。発売日の新しい順(sort=-releaseDate)に
   * 固定しているため、呼び出し側は新しい順にページを辿り、DB既知の本に当たった時点で
   * 打ち切ることで「新刊の見落とし無し」と「無駄なページ取得を避ける」を両立できる。
   * マッチングは楽天側の検索に任せ、こちらでの表記ゆれ吸収(あいまい一致)は行わない。
   */
  async searchByAuthorPage(name: string, page: number): Promise<AuthorSearchPage> {
    const { items, pageCount, count } = await this.search({ author: name, sort: "-releaseDate" }, 30, page);
    return { items: items.map(toBookInfo), page, pageCount, count };
  }

  /**
   * おすすめ本機能向けの汎用検索(ジャンル/著者/タイトルキーワードいずれの条件でも使う)。
   * 発売日の新しい順に固定。pageCountを返すので、呼び出し側で毎回違うページを引いて
   * 「更新する」のたびに違う候補が出るようにできる。
   */
  async searchForRecommendation(
    query: Record<string, string>,
    hits: number,
    page: number,
  ): Promise<{ items: BookInfo[]; pageCount: number }> {
    const { items, pageCount } = await this.search({ ...query, sort: "-releaseDate" }, hits, page);
    return { items: items.map(toBookInfo), pageCount };
  }

  private async search(
    query: Record<string, string>,
    hits = 10,
    page = 1,
  ): Promise<{ items: RakutenBookItem[]; pageCount: number; count: number }> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("applicationId", this.applicationId);
    url.searchParams.set("accessKey", this.accessKey);
    url.searchParams.set("formatVersion", "2");
    url.searchParams.set("hits", String(hits));
    url.searchParams.set("page", String(page));
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    for (let attempt = 1; ; attempt++) {
      await throttle();
      const res = await fetch(url, {
        headers: { "User-Agent": "book-radar/0.1 (personal use; book metadata lookup)" },
      });

      if (res.status === 429) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new Error("楽天ブックスAPIへのアクセスが集中しています。しばらく待ってから再度お試しください。");
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
      return { items, pageCount: data.pageCount ?? 1, count: data.count ?? items.length };
    }
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
    itemCaption: item.itemCaption || null,
    genreId: item.booksGenreId || null,
    reviewCount: item.reviewCount ?? 0,
    reviewAverage: item.reviewAverage ? Number(item.reviewAverage) : null,
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
