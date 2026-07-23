import "dotenv/config";
import { createServer, type ServerResponse } from "node:http";
import { listAuthors } from "../core/authorService.js";
import { getAuthorBooks } from "../core/authorBooks.js";
import { checkBook } from "../core/checkBook.js";
import { searchBookInfoByTitle } from "../core/bookInfoService.js";
import {
  renderHomePage,
  renderAuthorPage,
  renderIsbnPage,
  renderTitleSearchPage,
  renderErrorPage,
} from "./views.js";

const PORT = Number(process.env.WEB_PORT ?? 3000);

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/") {
      sendHtml(res, 200, renderHomePage(listAuthors()));
      return;
    }

    if (url.pathname === "/author") {
      const name = url.searchParams.get("name") ?? "";
      const limit = Number(url.searchParams.get("limit") ?? "10");
      sendHtml(res, 200, renderAuthorPage(getAuthorBooks(name, limit)));
      return;
    }

    if (url.pathname === "/isbn") {
      const isbn = url.searchParams.get("isbn") ?? "";
      if (!isbn) throw new Error("ISBNを入力してください。");
      sendHtml(res, 200, renderIsbnPage(await checkBook(isbn)));
      return;
    }

    if (url.pathname === "/search") {
      const q = url.searchParams.get("q") ?? "";
      if (!q) throw new Error("検索キーワードを入力してください。");
      sendHtml(res, 200, renderTitleSearchPage(q, await searchBookInfoByTitle(q)));
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
