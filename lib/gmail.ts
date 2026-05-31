import nodemailer from 'nodemailer';

// modoo_app/lib/gmail.ts 재사용 — GMAIL_USER/GMAIL_APP_PASSWORD (.env.local) 기반 SMTP 발송.

interface GmailRecipient {
  email: string;
  name?: string;
}

interface SendGmailParams {
  to: GmailRecipient[];
  subject: string;
  text: string;
  html: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Gmail 환경변수(GMAIL_USER, GMAIL_APP_PASSWORD)가 설정되지 않았습니다.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
}

export async function sendGmailEmail({ to, subject, text, html }: SendGmailParams): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  const fromName = '모두의 유니폼';
  const fromEmail = process.env.GMAIL_USER;

  try {
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', '),
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('Gmail 발송 실패:', error);
    return false;
  }
}
