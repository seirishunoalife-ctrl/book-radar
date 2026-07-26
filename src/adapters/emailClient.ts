import nodemailer from "nodemailer";

/**
 * 入荷通知メール送信。Gmailのアプリパスワード方式(SMTP)を使う。OAuth不要で設定が簡単なため
 * 個人利用のスクリプトにはこちらを採用した(book-metadata-research.mdの他API選定と同様、
 * 実装のしやすさを優先)。
 */
export async function sendNotificationEmail(subject: string, bodyText: string): Promise<void> {
  const user = mustGetEnv("GMAIL_USER");
  const pass = mustGetEnv("GMAIL_APP_PASSWORD");
  const to = process.env.NOTIFY_EMAIL_TO || user;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({ from: user, to, subject, text: bodyText });
}

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (check library/.env)`);
  }
  return value;
}
