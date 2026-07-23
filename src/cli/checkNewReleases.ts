import "dotenv/config";
import { listAuthors } from "../core/authorService.js";
import { checkNewReleasesForAllAuthors } from "../core/newReleaseCheck.js";

const authors = listAuthors();

if (authors.length === 0) {
  console.log("登録済みの作家がいません。npm run add-author -- <作家名> で登録してください。");
  process.exit(0);
}

console.log(`登録済み作家 ${authors.length} 人分の新刊をチェックします...\n`);

const results = await checkNewReleasesForAllAuthors();

for (const { author, newReleases } of results) {
  console.log(`【${author.name}】`);
  if (newReleases.length === 0) {
    console.log("  新刊候補なし\n");
    continue;
  }
  for (const result of newReleases) {
    console.log(`  ○ ${result.bookInfo?.title ?? result.isbn} (ISBN: ${result.isbn})`);
    if (result.holdings.length === 0) {
      console.log("    宇部市立図書館: 所蔵なし");
    } else {
      for (const holding of result.holdings) {
        console.log(`    ${holding.branchCode}: ${holding.status}`);
      }
    }
  }
  console.log();
}
