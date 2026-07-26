import type { Author } from "../core/authorService.js";
import type { AuthorBooksResult } from "../core/authorBooks.js";
import type { CheckBookResult } from "../core/checkBook.js";
import type { WatchlistBook } from "../core/watchlistService.js";
import type { AuthorSearchPage, TitleSearchPage } from "../adapters/rakutenBooksClient.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
  html { font-size: 18px; }
  body { font-family: sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; font-size: 1rem; }
  h1 { font-size: 1.3rem; }
  h1 a { text-decoration: none; color: inherit; }
  nav { margin-bottom: 1.5rem; }
  form.search { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  form.search input { flex: 1; padding: 0.3rem; font-size: 1rem; }
  form.search button { font-size: 1rem; }
  ul.authors { list-style: none; padding: 0; }
  ul.authors li { margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.5rem; }
  form.register { margin-top: 1rem; }
  button.register-btn { padding: 0.4rem 1rem; font-size: 1rem; }
  .already-registered { color: #2a7a2a; }
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
  .track-btn { display: inline-block; padding: 0.15rem 0.6rem; border: 1px solid #666; border-radius: 4px; background: none; font-size: 0.85rem; margin-left: 0.3rem; margin-top: 0.3rem; cursor: pointer; }
  .track-btn.remove { border-color: #b00; color: #b00; }
  .unregister-btn { border: none; background: none; color: #b00; font-size: 0.85rem; cursor: pointer; padding: 0; text-decoration: underline; }
  .more-link { display: inline-block; margin-top: 1rem; }
  .hint { color: #666; font-size: 0.9rem; }
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
<h1><a href="/">book-radar</a></h1>
${body}
</body>
</html>`;
}

function searchForms(): string {
  return `
<nav>
  <form class="search" action="/search" method="get">
    <input type="text" name="q" placeholder="タイトルの一部で検索" required>
    <button type="submit">タイトル検索</button>
  </form>
  <form class="search" action="/author-search" method="get">
    <input type="text" name="name" placeholder="作家名で検索" required>
    <button type="submit">作家名で検索</button>
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

/**
 * 「気になる本」への登録/解除トグルボタン。未登録なら追加フォーム、登録済みなら削除フォームを出す。
 * returnTo を渡すと、操作後にそのページへ戻る(省略時は追加後は/isbn、削除後は/)。
 */
function renderTrackToggle(isbn: string, bookId: number | null, isTracked: boolean, returnTo?: string): string {
  const returnToField = returnTo ? `<input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">` : "";
  if (isTracked && bookId !== null) {
    return `<form action="/watchlist/remove" method="post">
      <input type="hidden" name="bookId" value="${bookId}">
      ${returnToField}
      <button type="submit" class="track-btn remove">気になる本から削除</button>
    </form>`;
  }
  return `<form action="/watchlist" method="post">
    <input type="hidden" name="isbn" value="${escapeHtml(isbn)}">
    ${returnToField}
    <button type="submit" class="track-btn">気になる本に登録する</button>
  </form>`;
}

function renderWatchlistItem(book: WatchlistBook): string {
  return `
<div class="book">
  ${book.coverImageUrl ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(book.title)}</div>
    <div>${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    ${renderHoldings(book.holdings)}
    ${renderTrackToggle(book.isbn13, book.bookId, true)}
  </div>
</div>`;
}

export function renderHomePage(authors: Author[], watchlistBooks: WatchlistBook[]): string {
  const authorList =
    authors.length === 0
      ? `<p>登録済みの作家がいません。上の「作家名で検索」から登録してください。</p>`
      : `<ul class="authors">${authors
          .map((a) => `<li><a href="/author?name=${encodeURIComponent(a.name)}">${escapeHtml(a.name)}</a></li>`)
          .join("")}</ul>`;

  const watchlistSection =
    watchlistBooks.length === 0
      ? `<p>気になる本はまだありません。タイトル検索・ISBN検索の結果から「追跡する」で追加できます。</p>`
      : watchlistBooks.map(renderWatchlistItem).join("");

  return layout(
    "ホーム",
    `
${searchForms()}
<h2>登録済み作家</h2>
${authorList}
<h2>気になる本</h2>
${watchlistSection}
`,
  );
}

const BOOKSHELF_PAGE_SIZE = 10;

export function renderAuthorPage(result: AuthorBooksResult, trackedBookIds: Set<number>): string {
  const { author, books, limit } = result;
  const returnTo = `/author?name=${encodeURIComponent(author.name)}&limit=${limit}`;
  const body =
    books.length === 0
      ? `<p>本棚がまだ空です。登録直後は新刊チェックをバックグラウンドで実行中の場合があります。数分待ってから再読み込みしてください。</p>`
      : books
          .map(
            (book) => `
<div class="book">
  ${book.coverImageUrl ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(book.title)}</div>
    <div>${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    ${renderHoldings(book.holdings)}
    ${renderTrackToggle(book.isbn13, book.bookId, trackedBookIds.has(book.bookId), returnTo)}
  </div>
</div>`,
          )
          .join("");

  // limitちょうど件数が返ってきた場合のみ「もっと見る」を表示する(それ以上が無ければ非表示)
  const moreLink =
    books.length === limit
      ? `<a class="more-link" href="/author?name=${encodeURIComponent(author.name)}&limit=${limit + BOOKSHELF_PAGE_SIZE}">もっと見る(+${BOOKSHELF_PAGE_SIZE}冊)</a>`
      : "";

  const unregisterForm = `
<form action="/authors/delete" method="post" style="margin-top: 1.5rem;">
  <input type="hidden" name="name" value="${escapeHtml(author.name)}">
  <button type="submit" class="unregister-btn">この作家の登録を解除する</button>
</form>`;

  return layout(
    author.name,
    `
${searchForms()}
<h2>${escapeHtml(author.name)}の本棚</h2>
${body}
${moreLink}
${unregisterForm}
`,
  );
}

export function renderIsbnPage(result: CheckBookResult, isTracked: boolean): string {
  const info = result.bookInfo;
  const returnTo = `/isbn?isbn=${encodeURIComponent(result.isbn)}`;
  const body = `
<div class="book">
  ${info?.coverImageUrl ? `<img src="${escapeHtml(info.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(info?.title ?? `(タイトル不明: ${result.isbn})`)}</div>
    <div>${escapeHtml(info?.authorName ?? "著者不明")} / ${escapeHtml(info?.publisher ?? "出版社不明")} / ${escapeHtml(info?.releaseDate ?? "発売日不明")}</div>
    <div>ISBN: ${escapeHtml(result.isbn)}</div>
    ${renderHoldings(result.holdings.map((h) => ({ branchName: h.branchCode, statusLabel: h.status ?? "未確認", reserveUrl: h.reserveUrl })))}
    ${renderTrackToggle(result.isbn, result.bookId, isTracked, returnTo)}
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

const TITLE_SEARCH_PAGE_SIZE = 10;

export function renderTitleSearchPage(keyword: string, page: TitleSearchPage): string {
  const { items, hits } = page;
  const body =
    items.length === 0
      ? `<p>該当する書籍が見つかりませんでした。</p>`
      : items
          .map(
            (book) => `
<div class="book">
  ${book.coverImageUrl ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div class="title">${escapeHtml(book.title)}</div>
    <div>${escapeHtml(book.authorName ?? "著者不明")} / ${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    <div><a href="/isbn?isbn=${encodeURIComponent(book.isbn13)}">この本の貸出状況を見る(ISBN: ${escapeHtml(book.isbn13)})</a></div>
    ${book.isbn13 ? renderTrackToggle(book.isbn13, null, false) : ""}
  </div>
</div>`,
          )
          .join("");

  // hitsちょうど件数(=楽天APIの上限30も含む)返ってきた場合のみ「もっと見る」を表示
  const moreLink =
    items.length === hits && hits < 30
      ? `<a class="more-link" href="/search?q=${encodeURIComponent(keyword)}&hits=${hits + TITLE_SEARCH_PAGE_SIZE}">もっと見る(+${TITLE_SEARCH_PAGE_SIZE}件)</a>`
      : "";

  return layout(
    "タイトル検索結果",
    `
${searchForms()}
<h2>「${escapeHtml(keyword)}」の検索結果</h2>
${body}
${moreLink}
`,
  );
}

const REPRESENTATIVE_TITLES_COUNT = 5;

export function renderAuthorSearchPage(
  name: string,
  page: AuthorSearchPage,
  alreadyRegisteredAuthor: Author | null,
): string {
  if (alreadyRegisteredAuthor) {
    return layout(
      "作家名で検索",
      `
${searchForms()}
<h2>「${escapeHtml(name)}」の検索結果</h2>
<p class="already-registered">登録済みです。</p>
<p><a href="/author?name=${encodeURIComponent(alreadyRegisteredAuthor.name)}">${escapeHtml(alreadyRegisteredAuthor.name)}の本棚を見る</a></p>
`,
    );
  }

  if (page.count === 0) {
    return layout(
      "作家名で検索",
      `
${searchForms()}
<h2>「${escapeHtml(name)}」の検索結果</h2>
<p>楽天ブックスAPIで書籍が見つかりませんでした。</p>
`,
    );
  }

  const sample = page.items.slice(0, REPRESENTATIVE_TITLES_COUNT);
  const sampleList = sample.map((book) => `<li>${escapeHtml(book.title)}(${escapeHtml(book.releaseDate ?? "発売日不明")})</li>`).join("");

  return layout(
    "作家名で検索",
    `
${searchForms()}
<h2>「${escapeHtml(name)}」の検索結果</h2>
<p>${page.count}件の書籍が見つかりました。代表的な本:</p>
<ul>${sampleList}</ul>
<form class="register" action="/authors" method="post">
  <input type="hidden" name="name" value="${escapeHtml(name)}">
  <button type="submit" class="register-btn">この作家を登録する</button>
</form>
`,
  );
}

export function renderErrorPage(message: string): string {
  return layout("エラー", `${searchForms()}<p class="error">${escapeHtml(message)}</p>`);
}
