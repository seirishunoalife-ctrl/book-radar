import "dotenv/config";
import { searchBookInfoByTitle } from "../core/bookInfoService.js";

const keyword = process.argv[2];

if (!keyword) {
  console.error("使い方: npm run search-title -- <タイトルの一部>");
  process.exit(1);
}

const results = await searchBookInfoByTitle(keyword);

if (results.length === 0) {
  console.log("該当する書籍が見つかりませんでした。");
  process.exit(0);
}

console.log(`"${keyword}" の検索結果 (${results.length}件、楽天ブックスAPI):\n`);
for (const book of results) {
  console.log(`- ${book.title}${book.seriesName ? `(${book.seriesName})` : ""} / ${book.authorName ?? "著者不明"}`);
  console.log(`  ISBN: ${book.isbn13 || "(なし)"}  発売日: ${book.releaseDate ?? "不明"}`);
  if (book.coverImageUrl) console.log(`  表紙: ${book.coverImageUrl}`);
  console.log();
}
console.log("→ npm run check-isbn -- <ISBN> で個別に蔵書状況を確認できます。");
