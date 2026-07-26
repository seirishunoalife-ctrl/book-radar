import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { addAuthor, getAuthorByName, listAuthors } from "../core/authorService.js";
import { getAuthorBooks } from "../core/authorBooks.js";
import { checkBook } from "../core/checkBook.js";
import { searchBookInfoByTitle, searchBookInfoByAuthorPage } from "../core/bookInfoService.js";
import {
  renderHomePage,
  renderAuthorPage,
  renderIsbnPage,
  renderTitleSearchPage,
  renderAuthorSearchPage,
  renderErrorPage,
} from "./views.js";

const PORT = Number(process.env.WEB_PORT ?? 3000);

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
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
      sendHtml(res, 200, renderHomePage(listAuthors()));
      return;
    }

    if (req.method === "GET" && url.pathname === "/author") {
      const name = url.searchParams.get("name") ?? "";
      const limit = Number(url.searchParams.get("limit") ?? "10");
      sendHtml(res, 200, renderAuthorPage(getAuthorBooks(name, limit)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/isbn") {
      const isbn = url.searchParams.get("isbn") ?? "";
      if (!isbn) throw new Error("ISBNを入力してください。");
      sendHtml(res, 200, renderIsbnPage(await checkBook(isbn)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/search") {
      const q = url.searchParams.get("q") ?? "";
      if (!q) throw new Error("検索キーワードを入力してください。");
      sendHtml(res, 200, renderTitleSearchPage(q, await searchBookInfoByTitle(q)));
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

      addAuthor(name);
      res.writeHead(302, { Location: `/author?name=${encodeURIComponent(name)}` });
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
