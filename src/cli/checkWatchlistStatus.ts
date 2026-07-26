import "dotenv/config";
import { refreshWatchlistAndNotify } from "../core/notificationService.js";

const { checked, notified, sendFailed } = await refreshWatchlistAndNotify();

console.log(`気になる本 ${checked} 冊の蔵書状況を再確認しました。`);

if (sendFailed) {
  console.log("入荷対象はありましたが、メール送信に失敗しました(詳細は上記のエラーログを参照。次回実行時に再送を試みます)。");
} else if (notified.length === 0) {
  console.log("入荷通知の対象はありませんでした。");
} else {
  console.log(`入荷通知メールを送信しました(${notified.length}冊):`);
  for (const n of notified) {
    console.log(`  ○ ${n.title}(${n.branchName})`);
  }
}

process.exit(0);
