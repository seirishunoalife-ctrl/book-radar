import "dotenv/config";
import { addAward } from "../core/awardsService.js";

const [awardName, title, authorName, awardYear, rankLabel] = process.argv.slice(2);

if (!awardName || !title) {
  console.error(
    "使い方: npm run add-award -- <賞名> <タイトル> [著者名] [年/回次] [順位・部門ラベル]\n" +
      '例: npm run add-award -- 本屋大賞 "汝、星のごとく" 凪良ゆう 2023 大賞',
  );
  process.exit(1);
}

addAward({ awardName, title, authorName, awardYear, rankLabel });
console.log(`登録しました: ${awardName} / ${title}${authorName ? ` (${authorName})` : ""}`);
