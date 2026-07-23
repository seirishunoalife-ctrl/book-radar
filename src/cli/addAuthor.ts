import "dotenv/config";
import { addAuthor } from "../core/authorService.js";

const name = process.argv[2];
const rakutenSearchKeyword = process.argv[3];

if (!name) {
  console.error("使い方: npm run add-author -- <作家名> [楽天検索用キーワード(表記ゆれ対策・省略可)]");
  process.exit(1);
}

const author = addAuthor(name, rakutenSearchKeyword);

console.log(`登録しました: id=${author.id} name=${author.name}`);
if (author.rakutenSearchKeyword) {
  console.log(`楽天検索キーワード: ${author.rakutenSearchKeyword}`);
}
console.log("\n→ npm run check-new-releases で新刊チェックを実行できます。");
