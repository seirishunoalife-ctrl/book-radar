import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { addAuthor, deleteAuthor, getAuthorByName, listAuthors } from "../core/authorService.js";
import { getAuthorBooks } from "../core/authorBooks.js";
import { checkBook } from "../core/checkBook.js";
import { checkNewReleasesForAuthor } from "../core/newReleaseCheck.js";
import {
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistNote,
  isInWatchlist,
  listWatchlist,
} from "../core/watchlistService.js";
import { searchBookInfoByTitleWithHits, searchBookInfoByAuthorPage } from "../core/bookInfoService.js";
import { getPreferences, savePreferences, parseLines } from "../core/preferencesService.js";
import { generateRecommendations, getCachedRecommendations } from "../core/recommendationService.js";
import { GENRE_CATALOG } from "../core/genreCatalog.js";
import {
  renderHomePage,
  renderAuthorPage,
  renderIsbnPage,
  renderTitleSearchPage,
  renderAuthorSearchPage,
  renderPreferencesPage,
  renderRecommendationsPage,
  renderErrorPage,
} from "./views.js";

const PORT = Number(process.env.WEB_PORT ?? 3000);

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

function readFormBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(new URLSearchParams(body)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      sendHtml(res, 200, renderHomePage(listAuthors(), listWatchlist()));
      return;
    }

    if (req.method === "GET" && url.pathname === "/author") {
      const name = url.searchParams.get("name") ?? "";
      const limit = Number(url.searchParams.get("limit") ?? "10");
      const trackedBookIds = new Set(listWatchlist().map((b) => b.bookId));
      sendHtml(res, 200, renderAuthorPage(getAuthorBooks(name, limit), trackedBookIds));
      return;
    }

    if (req.method === "GET" && url.pathname === "/isbn") {
      const isbn = url.searchParams.get("isbn") ?? "";
      if (!isbn) throw new Error("ISBNを入力してください。");
      const result = await checkBook(isbn);
      sendHtml(res, 200, renderIsbnPage(result, isInWatchlist(result.bookId)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/search") {
      const q = url.searchParams.get("q") ?? "";
      if (!q) throw new Error("検索キーワードを入力してください。");
      const hits = Number(url.searchParams.get("hits") ?? "10");
      sendHtml(res, 200, renderTitleSearchPage(q, await searchBookInfoByTitleWithHits(q, hits)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/author-search") {
      const name = url.searchParams.get("name") ?? "";
      if (!name) throw new Error("作家名を入力してください。");

      const existing = getAuthorByName(name);
      if (existing) {
        sendHtml(res, 200, renderAuthorSearchPage(name, { items: [], page: 1, pageCount: 1, count: 0 }, existing));
        return;
      }
      const page = await searchBookInfoByAuthorPage(name, 1);
      sendHtml(res, 200, renderAuthorSearchPage(name, page, null));
      return;
    }

    if (req.method === "POST" && url.pathname === "/authors") {
      const form = await readFormBody(req);
      const name = form.get("name") ?? "";
      if (!name) throw new Error("作家名が指定されていません。");

      const author = addAuthor(name);
      // 新刊チェックはバックグラウンドで実行する(多作な作家だと数分かかるため、
      // レスポンスをブロックしない。本棚ページは結果を待たずにすぐ表示する)。
      checkNewReleasesForAuthor(author).catch((error) => {
        console.error(`「${author.name}」の登録時新刊チェックに失敗しました:`, error instanceof Error ? error.message : error);
      });
      res.writeHead(302, { Location: `/author?name=${encodeURIComponent(name)}` });
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/watchlist") {
      const form = await readFormBody(req);
      const isbn = form.get("isbn") ?? "";
      if (!isbn) throw new Error("ISBNが指定されていません。");

      await addToWatchlist(isbn);
      const returnTo = form.get("returnTo") || `/isbn?isbn=${encodeURIComponent(isbn)}`;
      res.writeHead(302, { Location: returnTo });
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/watchlist/remove") {
      const form = await readFormBody(req);
      const bookId = Number(form.get("bookId") ?? "");
      if (!bookId) throw new Error("bookIdが指定されていません。");

      removeFromWatchlist(bookId);
      const returnTo = form.get("returnTo") || "/";
      res.writeHead(302, { Location: returnTo });
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/watchlist/note") {
      const form = await readFormBody(req);
      const bookId = Number(form.get("bookId") ?? "");
      if (!bookId) throw new Error("bookIdが指定されていません。");

      updateWatchlistNote(bookId, form.get("note") ?? "");
      const returnTo = form.get("returnTo") || "/";
      res.writeHead(302, { Location: returnTo });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/preferences") {
      const saved = url.searchParams.get("saved") === "1";
      sendHtml(res, 200, renderPreferencesPage(getPreferences(), GENRE_CATALOG, saved));
      return;
    }

    if (req.method === "POST" && url.pathname === "/preferences") {
      const form = await readFormBody(req);
      savePreferences({
        favoriteGenreIds: form.getAll("genreIds"),
        favoriteAuthors: parseLines(form.get("authors") ?? ""),
        businessThemes: parseLines(form.get("themes") ?? ""),
      });
      res.writeHead(302, { Location: "/preferences?saved=1" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/recommendations") {
      const trackedBookIdsByIsbn = new Map(listWatchlist().map((b) => [b.isbn13, b.bookId]));
      sendHtml(res, 200, renderRecommendationsPage(getCachedRecommendations(), trackedBookIdsByIsbn));
      return;
    }

    if (req.method === "POST" && url.pathname === "/recommendations/refresh") {
      await generateRecommendations();
      res.writeHead(302, { Location: "/recommendations" });
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/authors/delete") {
      const form = await readFormBody(req);
      const name = form.get("name") ?? "";
      if (!name) throw new Error("作家名が指定されていません。");

      const author = getAuthorByName(name);
      if (author) deleteAuthor(author.id);
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    sendHtml(res, 404, renderErrorPage("ページが見つかりません。"));
  } catch (error) {
    sendHtml(res, 500, renderErrorPage(error instanceof Error ? error.message : String(error)));
  }
});

server.listen(PORT, () => {
  console.log(`book-radar 簡易画面: http://localhost:${PORT}`);
});
