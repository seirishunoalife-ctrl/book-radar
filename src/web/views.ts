import type { Author } from "../core/authorService.js";
import type { AuthorBooksResult } from "../core/authorBooks.js";
import type { CheckBookResult } from "../core/checkBook.js";
import type { WatchlistBook } from "../core/watchlistService.js";
import type { Preferences } from "../core/preferencesService.js";
import type { RecommendedBook } from "../core/recommendationService.js";
import type { GenreOption } from "../core/genreCatalog.js";
import type { AuthorSearchPage, TitleSearchPage } from "../adapters/rakutenBooksClient.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 「温かみ・ナチュラル」な方向性の配色(深緑メイン)。書店・図書館のような落ち着いた雰囲気を意図している。
const COLOR = {
  bg: "#FAF6EF", // ページ背景(生成り)
  surface: "#FFFFFF", // カード背景
  text: "#33291F", // 本文(暖色の墨色)
  textMuted: "#7A6A52", // 補足テキスト(暖色グレー)
  accent: "#4B6350", // 主要アクション(深緑)
  accentDark: "#3A4D3F", // 深緑の濃色(ホバー・強調用)
  border: "#E3D9C6", // 枠線・区切り(ベージュ)
  borderSoft: "#EDE4D3", // より淡い区切り線
  statusOkBg: "#E4EFE1",
  statusLoanBg: "#F5E8D8",
  statusLoanText: "#8B5E3C",
  statusNoneBg: "#F0EAE0",
  statusNoneText: "#9C8F7A",
  danger: "#B0413E", // 削除・エラー(落ち着いた赤茶)
};

const STYLE = `
  html { font-size: 18px; color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif;
    max-width: 720px; margin: 2rem auto; padding: 0 1.25rem 3rem; line-height: 1.75; font-size: 1rem;
    color: ${COLOR.text}; background: ${COLOR.bg}; letter-spacing: 0.01em;
  }
  button { -webkit-appearance: none; appearance: none; color: ${COLOR.text}; font-family: inherit; }
  h1 { font-size: 1.4rem; color: ${COLOR.accentDark}; margin: 0 0 1.5rem; padding-bottom: 0.9rem; border-bottom: 1px solid ${COLOR.border}; letter-spacing: 0.03em; }
  h1 a { text-decoration: none; color: inherit; }
  h2 { font-size: 1.1rem; color: ${COLOR.accentDark}; margin-top: 2rem; }
  h3 { font-size: 1rem; color: ${COLOR.accentDark}; margin-top: 1.75rem; }
  nav { margin-bottom: 1.75rem; }
  form.search { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  form.search input {
    flex: 1; min-width: 0; padding: 0.5rem 0.75rem; font-size: 1rem; border: 1px solid ${COLOR.border}; border-radius: 8px;
    background: ${COLOR.surface}; color: ${COLOR.text};
  }
  form.search button, button.register-btn, .save-btn {
    padding: 0.5rem 1.1rem; font-size: 1rem; border: none; border-radius: 8px;
    background: ${COLOR.accent}; color: #fff; cursor: pointer; white-space: nowrap; flex-shrink: 0;
  }
  form.search button:active, button.register-btn:active, .save-btn:active { background: ${COLOR.accentDark}; }
  ul.authors { list-style: none; padding: 0; }
  ul.authors li { margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; }
  form.register { margin-top: 1rem; }
  .already-registered { color: ${COLOR.accentDark}; }
  .book {
    display: flex; gap: 1rem; background: ${COLOR.surface}; border: 1px solid ${COLOR.borderSoft};
    border-radius: 12px; padding: 1rem; margin-bottom: 0.85rem;
  }
  .book img { width: 80px; height: auto; flex-shrink: 0; border-radius: 6px; }
  .book .meta { flex: 1; }
  .book .title { font-weight: bold; }
  .holding { margin-top: 0.4rem; font-size: 0.9rem; }
  .status { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${COLOR.statusNoneBg}; color: ${COLOR.statusNoneText}; margin-right: 0.3rem; }
  .status.ok { background: ${COLOR.statusOkBg}; color: ${COLOR.accentDark}; }
  .status.loan { background: ${COLOR.statusLoanBg}; color: ${COLOR.statusLoanText}; }
  .status.none { background: ${COLOR.statusNoneBg}; color: ${COLOR.statusNoneText}; }
  a.reserve-btn {
    display: inline-block; padding: 0.2rem 0.7rem; border: 1px solid ${COLOR.accent}; border-radius: 999px;
    text-decoration: none; color: ${COLOR.accentDark}; font-size: 0.85rem; margin-left: 0.3rem;
  }
  .track-btn {
    display: inline-block; padding: 0.25rem 0.75rem; border: 1px solid ${COLOR.accent}; border-radius: 999px;
    background: none; color: ${COLOR.accentDark}; font-size: 0.85rem; margin-left: 0.3rem; margin-top: 0.5rem; cursor: pointer;
  }
  .track-btn.remove { border-color: ${COLOR.danger}; color: ${COLOR.danger}; }
  .unregister-btn { border: none; background: none; color: ${COLOR.danger}; font-size: 0.85rem; cursor: pointer; padding: 0; text-decoration: underline; }
  .more-link { display: inline-block; margin-top: 1.2rem; color: ${COLOR.accentDark}; }
  .hint { color: ${COLOR.textMuted}; font-size: 0.9rem; }
  .error { color: ${COLOR.danger}; }
  .book .title a { color: inherit; text-decoration: none; }
  .book .title a:hover { text-decoration: underline; }
  .book-detail { display: flex; gap: 1.2rem; margin-bottom: 1.2rem; background: ${COLOR.surface}; border: 1px solid ${COLOR.borderSoft}; border-radius: 12px; padding: 1.2rem; }
  .book-detail img { width: 160px; height: auto; flex-shrink: 0; border-radius: 8px; }
  .book-detail .meta > div { margin-bottom: 0.4rem; }
  .caption { white-space: pre-wrap; background: ${COLOR.surface}; border: 1px solid ${COLOR.borderSoft}; padding: 1rem; border-radius: 10px; margin: 1rem 0; color: ${COLOR.text}; }
  .sub-nav { font-size: 0.85rem; margin-top: 0.5rem; }
  .sub-nav a { color: ${COLOR.accentDark}; }
  .reason { color: ${COLOR.textMuted}; font-size: 0.85rem; margin-top: 0.3rem; }
  fieldset { border: 1px solid ${COLOR.borderSoft}; border-radius: 12px; margin-bottom: 1.2rem; padding: 1rem; background: ${COLOR.surface}; }
  legend { color: ${COLOR.accentDark}; padding: 0 0.4rem; }
  .genre-list label { display: block; margin-bottom: 0.4rem; }
  textarea {
    width: 100%; box-sizing: border-box; font-size: 1rem; padding: 0.6rem; font-family: inherit;
    border: 1px solid ${COLOR.border}; border-radius: 8px; background: #fff; color: ${COLOR.text};
  }
  .saved-notice { color: ${COLOR.accentDark}; }
  .note-form { margin-top: 0.5rem; }
  .note-form input[type="text"] {
    width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem; font-size: 0.9rem;
    border: 1px solid ${COLOR.border}; border-radius: 8px; background: #fff; color: ${COLOR.text};
  }
  a { color: ${COLOR.accentDark}; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
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
  <div class="sub-nav"><a href="/recommendations">おすすめ本</a> / <a href="/preferences">好みの設定</a></div>
</nav>`;
}

function statusClass(label: string): string {
  if (label === "未入荷") return "none";
  if (label === "貸出中") return "loan";
  return "ok";
}

/** 本の詳細ページ(/isbn)へのリンク付きタイトル。一覧(本棚・検索結果・気になる本)で共通に使う。 */
function bookTitleLink(isbn13: string, title: string): string {
  if (!isbn13) return escapeHtml(title);
  return `<a href="/isbn?isbn=${encodeURIComponent(isbn13)}">${escapeHtml(title)}</a>`;
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

// 保存ボタンは置かず、テキスト入力後にEnter(モバイルでは「完了」キー)で送信する
// (フォーム内の入力欄が1つだけなら、送信ボタンが無くてもEnterで暗黙的に送信される)。
function renderNoteForm(bookId: number, note: string | null): string {
  return `<form class="note-form" action="/watchlist/note" method="post">
    <input type="hidden" name="bookId" value="${bookId}">
    <input type="hidden" name="returnTo" value="/">
    <input type="text" name="note" value="${escapeHtml(note ?? "")}" placeholder="備考(例: 〇〇さんに勧められた。入力後Enterで保存)">
  </form>`;
}

function renderWatchlistItem(book: WatchlistBook): string {
  return `
<div class="book">
  ${book.coverImageUrl ? `<a href="/isbn?isbn=${encodeURIComponent(book.isbn13)}"><img src="${escapeHtml(book.coverImageUrl)}" alt=""></a>` : ""}
  <div class="meta">
    <div class="title">${bookTitleLink(book.isbn13, book.title)}</div>
    <div>${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    ${renderHoldings(book.holdings)}
    ${renderNoteForm(book.bookId, book.note)}
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
  ${book.coverImageUrl ? `<a href="/isbn?isbn=${encodeURIComponent(book.isbn13)}"><img src="${escapeHtml(book.coverImageUrl)}" alt=""></a>` : ""}
  <div class="meta">
    <div class="title">${bookTitleLink(book.isbn13, book.title)}</div>
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
  const title = info?.title ?? `(タイトル不明: ${result.isbn})`;

  const detail = `
<div class="book-detail">
  ${info?.coverImageUrl ? `<img src="${escapeHtml(info.coverImageUrl)}" alt="">` : ""}
  <div class="meta">
    <div>${escapeHtml(info?.authorName ?? "著者不明")}</div>
    <div>${escapeHtml(info?.publisher ?? "出版社不明")} / ${escapeHtml(info?.releaseDate ?? "発売日不明")}</div>
    <div>ISBN: ${escapeHtml(result.isbn)}</div>
  </div>
</div>`;

  const caption = info?.itemCaption ? `<p class="caption">${escapeHtml(info.itemCaption)}</p>` : "";

  const body = `
${detail}
${caption}
${renderHoldings(result.holdings.map((h) => ({ branchName: h.branchCode, statusLabel: h.status ?? "未確認", reserveUrl: h.reserveUrl })))}
${renderTrackToggle(result.isbn, result.bookId, isTracked, returnTo)}
`;

  return layout(
    title,
    `
${searchForms()}
<h2>${escapeHtml(title)}</h2>
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
  ${book.coverImageUrl ? `<a href="/isbn?isbn=${encodeURIComponent(book.isbn13)}"><img src="${escapeHtml(book.coverImageUrl)}" alt=""></a>` : ""}
  <div class="meta">
    <div class="title">${bookTitleLink(book.isbn13, book.title)}</div>
    <div>${escapeHtml(book.authorName ?? "著者不明")} / ${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    <div>ISBN: ${escapeHtml(book.isbn13)}</div>
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

export function renderPreferencesPage(prefs: Preferences, genreCatalog: GenreOption[], saved: boolean): string {
  const genreCheckboxes = genreCatalog
    .map((g) => {
      const checked = prefs.favoriteGenreIds.includes(g.id) ? " checked" : "";
      return `<label><input type="checkbox" name="genreIds" value="${escapeHtml(g.id)}"${checked}> ${escapeHtml(g.name)}</label>`;
    })
    .join("");

  return layout(
    "好みの設定",
    `
${searchForms()}
<h2>好みの設定</h2>
${saved ? `<p class="saved-notice">保存しました。</p>` : ""}
<form action="/preferences" method="post">
  <fieldset>
    <legend>好きなジャンル(複数選択可)</legend>
    <div class="genre-list">${genreCheckboxes}</div>
  </fieldset>
  <fieldset>
    <legend>好きな作家(1行に1人)</legend>
    <textarea name="authors" rows="4" placeholder="例:&#10;東野圭吾&#10;中山七里">${escapeHtml(prefs.favoriteAuthors.join("\n"))}</textarea>
  </fieldset>
  <fieldset>
    <legend>ビジネス書のテーマ(1行に1件)</legend>
    <textarea name="themes" rows="3" placeholder="例:&#10;マネジメント&#10;マーケティング">${escapeHtml(prefs.businessThemes.join("\n"))}</textarea>
  </fieldset>
  <fieldset>
    <legend>備考(おすすめ本探しの参考にする自由記述、1行に1件)</legend>
    <textarea name="notes" rows="3" placeholder="例:&#10;短編集&#10;泣ける話">${escapeHtml(prefs.notes.join("\n"))}</textarea>
    <p class="hint">タイトルのキーワード検索に使われます(文章より単語の方が見つかりやすいです)。</p>
  </fieldset>
  <button type="submit" class="save-btn">保存する</button>
</form>
`,
  );
}

function renderRecommendationItem(book: RecommendedBook, trackedBookIdsByIsbn: Map<string, number>): string {
  const bookId = trackedBookIdsByIsbn.get(book.isbn13) ?? null;
  return `
<div class="book">
  ${book.coverImageUrl ? `<a href="/isbn?isbn=${encodeURIComponent(book.isbn13)}"><img src="${escapeHtml(book.coverImageUrl)}" alt=""></a>` : ""}
  <div class="meta">
    <div class="title">${bookTitleLink(book.isbn13, book.title)}</div>
    <div>${escapeHtml(book.authorName ?? "著者不明")} / ${escapeHtml(book.releaseDate ?? "発売日不明")}</div>
    <div class="reason">${escapeHtml(book.reason)}</div>
    ${renderTrackToggle(book.isbn13, bookId, bookId !== null, "/recommendations")}
  </div>
</div>`;
}

export function renderRecommendationsPage(books: RecommendedBook[], trackedBookIdsByIsbn: Map<string, number>): string {
  const fiction = books.filter((b) => b.category === "fiction");
  const business = books.filter((b) => b.category === "business");

  const body =
    books.length === 0
      ? `<p>おすすめ本はまだ生成されていません。<a href="/preferences">好みの設定</a>で登録するか、「気になる本リスト」に本を追加してから、下のボタンで生成してください。</p>`
      : `
<h3>小説・エッセイ系</h3>
${fiction.length === 0 ? `<p class="hint">該当なし</p>` : fiction.map((b) => renderRecommendationItem(b, trackedBookIdsByIsbn)).join("")}
<h3>ビジネス書・実用書系</h3>
${business.length === 0 ? `<p class="hint">該当なし</p>` : business.map((b) => renderRecommendationItem(b, trackedBookIdsByIsbn)).join("")}
`;

  return layout(
    "おすすめ本",
    `
${searchForms()}
<h2>おすすめ本</h2>
${body}
<form action="/recommendations/refresh" method="post" style="margin-top: 1rem;">
  <button type="submit" class="save-btn">更新する</button>
</form>
`,
  );
}

export function renderErrorPage(message: string): string {
  return layout("エラー", `${searchForms()}<p class="error">${escapeHtml(message)}</p>`);
}
