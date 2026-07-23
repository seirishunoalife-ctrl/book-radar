import "dotenv/config";
import { checkBook } from "../core/checkBook.js";

const isbn = process.argv[2];
const title = process.argv[3];

if (!isbn) {
  console.error("使い方: npm run check-isbn -- <ISBN> [タイトル(書誌情報が見つからない場合の代替表示)]");
  process.exit(1);
}

const result = await checkBook(isbn, { title });

console.log(`\nISBN: ${result.isbn}`);

if (result.bookInfo) {
  console.log(`タイトル: ${result.bookInfo.title}`);
  console.log(`著者: ${result.bookInfo.authorName ?? "(不明)"}`);
  console.log(`出版社: ${result.bookInfo.publisher ?? "(不明)"}`);
  console.log(`発売日: ${result.bookInfo.releaseDate ?? "(不明)"}`);
  console.log(`表紙画像: ${result.bookInfo.coverImageUrl ?? "(なし)"}`);
  console.log(`書誌情報の取得元: ${result.bookInfo.source === "rakuten" ? "楽天ブックスAPI" : "openBD"}`);
} else {
  console.log("書誌情報: 楽天ブックスAPI/openBDのいずれからも取得できませんでした");
}

if (result.holdings.length === 0) {
  console.log("→ 宇部市立図書館(本館/学くすのき)には所蔵なし");
} else {
  console.log("→ 所蔵あり:");
  for (const holding of result.holdings) {
    console.log(`  - ${holding.branchCode}: ${holding.status}`);
    if (holding.reserveUrl) {
      console.log(`    詳細/予約: ${holding.reserveUrl}`);
    }
  }
}
