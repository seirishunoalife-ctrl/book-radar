import type { Author } from "../core/authorService.js";
import type { AuthorBooksResult } from "../core/authorBooks.js";
import type { CheckBookResult } from "../core/checkBook.js";
import type { BookInfo } from "../adapters/bookMetadataProvider.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
  body { font-family: sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
  h1 { font-size: 1.3rem; }
  h1 a { text-decoration: none; color: inherit; }
  nav { margin-bottom: 1.5rem; }
  form.search { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  form.search input { flex: 1; padding: 0.3rem; }
  ul.authors { list-style: none; padding: 0; }
  ul.authors li { margin-bottom: 0.3rem; }
  .book { display: flex; gap: 1rem; border-bottom: 1px solid #ddd; padding: 0.75rem 0; }
  .book img { width: 80px; height: auto; flex-shrink: 0; }
  .book .meta { flex: 1; }
  .book .title { font-weight: bold; }
  .holding { margin-top: 0.3rem; font-size: 0.9rem; }
  .status { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; background: #eee; margin-right: 0.3rem; }
  .status.ok { background: #dff5df; }
  .status.loan { background: #f5e8df; }
  .status.none { background: #f0f0f0; color: #888; }
  a.reserve-btn { display: inline-block; padding: 0.15rem 0.6rem; border: 1px solid #666; border-radius: 4px; text-decoration: none; color: inherit; font-size: 0.85rem; margin-left: 0.3rem; }
  .error { color: #b00; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - book-radar</title>
<style>${STYLE}</style>
</head>
<body>
<h1><a href="/">book-radar 簡易画面</a></h1>
${body}
</body>
</html>`;
}

function searchForms(): string {
  return `
<nav>
  <form class="search" action="/isbn" method="get">
    <input type="text" name="isbn" placeholder="ISBNで検索" required>
    <button type="submit">ISBN検索</button>
  </form>
  <form class="search" action="/search" method="get">
    <input type="text" name="q" placeholder="タイトルの一部で検索" required>
    <button type="submit">タイトル検索</button>
  </form>
</nav>`;
}

function statusClass(label: string): string {
  if (label === "未入荷") return "none";
  if (label === "貸出中") return "loan";
  return "ok";
}

function renderHoldings(holdings: { branchName: string; statusLabel: string; reserveUrl: string | null }[]): string {
  if (holdings.length === 0) {
    return `<div class="holding"><span class="status none">未入荷</span></div>`;
  }
  const parts = holdings.map((h) => {
    const badge = `<span class="status ${statusClass(h.statusLabel)}">${escapeHtml(h.branchName)}: ${escapeHtml(h.statusLabel)}</span>`;
    const button = h.reserveUrl
      ? `<a class="reserve-btn" href="${escapeHtml(h.reserveUrl)}" target="_blank" rel="noopener">予約/詳細</a>`
      : "";
    return badge + button;
  });
  return `<div class="holding">${parts.join(" ")}</div>`;
}

export function renderHomePage(authors: Author[]): string {
  const authorList =
    authors.length === 0
      ? `<p>登録済みの作家がいません。<code>npm run add-author -- 作家名</code> で登録してください。</p>`
      : `<ul class="authors">${authors
          .map((a) => `<li><a href="/author?name=${encodeURIComponent(a.name)}">${escapeHtml(a.name)}</a></li>`)
          .join("")}</ul>`;

  return layout(
    "ホーム",
    `
${searchForms()}
<h2>登録済み作家</h2>
${authorList}
`,
  );
}

export function renderAuthorPage(result: AuthorBooksResult): string {
  const { author, books } = result;
  const body =
    books.length === 0
      ? `<p>DBに登録済みの本がありません。<code>npm run check-new-releases</code> を実行してください。</p>`
      : books
          .map(
            (book) => `
<div class="book">
  ${book.coverImageUrl ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(book.title)}</div>
    <div>${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    ${renderHoldings(book.holdings)}
  </div>
</div>`,
          )
          .join("");

  return layout(
    author.name,
    `
${searchForms()}
<h2>${escapeHtml(author.name)}の本棚</h2>
${body}
`,
  );
}

export function renderIsbnPage(result: CheckBookResult): string {
  const info = result.bookInfo;
  const body = `
<div class="book">
  ${info?.coverImageUrl ? `<img src="${escapeHtml(info.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(info?.title ?? `(タイトル不明: ${result.isbn})`)}</div>
    <div>${escapeHtml(info?.authorName ?? "著者不明")} / ${escapeHtml(info?.publisher ?? "出版社不明")} / ${escapeHtml(info?.releaseDate ?? "発売日不明")}</div>
    <div>ISBN: ${escapeHtml(result.isbn)}</div>
    ${renderHoldings(result.holdings.map((h) => ({ branchName: h.branchCode, statusLabel: h.status ?? "未確認", reserveUrl: h.reserveUrl })))}
  </div>
</div>`;

  return layout(
    "ISBN検索結果",
    `
${searchForms()}
<h2>ISBN検索結果</h2>
${body}
`,
  );
}

export function renderTitleSearchPage(keyword: string, results: BookInfo[]): string {
  const body =
    results.length === 0
      ? `<p>該当する書籍が見つかりませんでした。</p>`
      : results
          .map(
            (book) => `
<div class="book">
  ${book.coverImageUrl ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(book.title)}</div>
    <div>${escapeHtml(book.authorName ?? "著者不明")} / ${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    <div><a href="/isbn?isbn=${encodeURIComponent(book.isbn13)}">この本の貸出状況を見る(ISBN: ${escapeHtml(book.isbn13)})</a></div>
  </div>
</div>`,
          )
          .join("");

  return layout(
    "タイトル検索結果",
    `
${searchForms()}
<h2>「${escapeHtml(keyword)}」の検索結果</h2>
${body}
`,
  );
}

export function renderErrorPage(message: string): string {
  return layout("エラー", `${searchForms()}<p class="error">${escapeHtml(message)}</p>`);
}
