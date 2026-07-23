import "dotenv/config";
import { getAuthorBooks } from "../core/authorBooks.js";

const name = process.argv[2];

if (!name) {
  console.error("使い方: npm run author-books -- <作家名> [--limit 件数]");
  process.exit(1);
}

const limitFlagIndex = process.argv.indexOf("--limit");
const limit = limitFlagIndex !== -1 ? Number(process.argv[limitFlagIndex + 1]) : 10;

const { author, books } = getAuthorBooks(name, limit);

console.log(`【${author.name}】の本棚 (発売日の新しい順、最大${limit}冊)\n`);

if (books.length === 0) {
  console.log("DBに登録済みの本がありません。npm run check-new-releases で新刊チェックを実行してください。");
  process.exit(0);
}

for (const book of books) {
  console.log(`- ${book.title} (${book.releaseDate ?? "発売日不明"})`);
  if (book.holdings.length === 0) {
    console.log("    未入荷");
  } else {
    console.log(`    ${book.holdings.map((h) => `${h.branchName}: ${h.statusLabel}`).join(" / ")}`);
  }
}
