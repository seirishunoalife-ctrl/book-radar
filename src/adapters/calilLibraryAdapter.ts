import type { BranchHolding, LibraryAdapter } from "./libraryAdapter.js";

const CALIL_CHECK_URL = "https://api.calil.jp/check";
const SYSTEM_ID = "Yamaguchi_Ube";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 30_000;

interface CalilBookResult {
  status: "OK" | "Cache" | "Running" | "Error";
  reserveurl?: string;
  libkey?: Record<string, string>;
}

interface CalilCheckResponse {
  session: string;
  continue: 0 | 1;
  books: Record<string, Record<string, CalilBookResult>>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * カーリル(https://calil.jp/)のCheck APIを使い、宇部市立図書館(systemid=Yamaguchi_Ube)の
 * 蔵書状況をISBNで検索するアダプタ。本館/学くすのきの区別はレスポンスのlibkeyオブジェクトの
 * キーで行う(キー名は実機確認済み: "本館" / "学くすのき")。
 */
export class CalilLibraryAdapter implements LibraryAdapter {
  constructor(private readonly appkey: string = mustGetAppkey()) {}

  async searchByIsbn(isbn: string): Promise<BranchHolding[]> {
    const first = await this.fetchCheck({ appkey: this.appkey, isbn, systemid: SYSTEM_ID });
    const result = await this.pollUntilDone(first);
    const bookResult = result.books[isbn]?.[SYSTEM_ID];

    if (!bookResult || bookResult.status === "Error") {
      throw new Error(`Calil API returned an error for isbn=${isbn}`);
    }

    return toBranchHoldings(bookResult);
  }

  private async pollUntilDone(response: CalilCheckResponse): Promise<CalilCheckResponse> {
    const startedAt = Date.now();
    let current = response;

    while (current.continue === 1) {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        throw new Error("Calil API polling timed out");
      }
      await sleep(POLL_INTERVAL_MS);
      current = await this.fetchCheck({ session: current.session });
    }

    return current;
  }

  private async fetchCheck(
    params: { appkey: string; isbn: string; systemid: string } | { session: string },
  ): Promise<CalilCheckResponse> {
    const url = new URL(CALIL_CHECK_URL);
    // callback=no を付けないとJSONPでラップされて返ってくる(実機確認済み)
    url.searchParams.set("format", "json");
    url.searchParams.set("callback", "no");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "book-radar/0.1 (personal use; ISBN holdings check)" },
    });
    if (!res.ok) {
      throw new Error(`Calil API request failed: HTTP ${res.status}`);
    }
    return (await res.json()) as CalilCheckResponse;
  }
}

function toBranchHoldings(bookResult: CalilBookResult): BranchHolding[] {
  const libkey = bookResult.libkey ?? {};
  const reserveUrl = bookResult.reserveurl || null;

  return Object.entries(libkey).map(([branchCode, status]) => ({
    branchCode,
    status,
    reserveUrl,
  }));
}

function mustGetAppkey(): string {
  const appkey = process.env.CALIL_APPKEY;
  if (!appkey) {
    throw new Error("CALIL_APPKEY is not set (check library/.env)");
  }
  return appkey;
}
