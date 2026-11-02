import 'server-only';
import { email as AM_EMAIL } from './i18n/dict/email';

/**
 * Emails the app sends. Every email is bilingual: Amharic first, English
 * second, in one message (the language cookie is unknown when sending, e.g.
 * for a password reset). Write English here and add the Amharic to
 * lib/i18n/dict/email.ts.
 *
 * HTML: tables and inline styles only, so it renders the same in Gmail,
 * Outlook and phone mail apps. A plain-text version is always included.
 */

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const am = (en: string) => AM_EMAIL[en] ?? en;

// Brand colours from app/global.css (emails cannot use CSS variables).
const C = {
  brand: '#1C6B60',
  brandDeep: '#0C453D',
  gold: '#D4A843',
  goldLight: '#E8C77B',
  cream: '#FEF9EA',
  page: '#F4F0E6',
  card: '#FAF8F2',
  edge: '#E2DACA',
  ink: '#2A1F12',
  inkMuted: '#75664A',
};

const FONT =
  "'Noto Sans Ethiopic','Nyala','Ebrima','Abyssinica SIL',Inter,Arial,Helvetica,sans-serif";

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** One email, written in English; the Amharic comes from the dictionary. */
interface Message {
  subject: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  /** One-time code or ID, shown large. */
  code?: string;
  /** Inline image (an attachment with this cid), e.g. a check-in QR. */
  image?: { cid: string; alt: string };
  notes?: string[];
}

function htmlSection(lang: 'am' | 'en', m: Message): string {
  const tr = lang === 'am' ? am : (s: string) => s;
  const p = (s: string, color = C.ink, size = 15) =>
    `<p style="margin:0 0 14px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};">${escape(tr(s))}</p>`;
  const button = m.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;"><tr>
        <td bgcolor="${C.brand}" style="border-radius:10px;">
          <a href="${escape(m.action.url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.cream};text-decoration:none;border-radius:10px;">${escape(tr(m.action.label))}</a>
        </td></tr></table>`
    : '';
  // Long IDs (FYP-…, ssu/…) smaller and tighter than a 6-digit code.
  const long = (m.code?.length ?? 0) > 8;
  const code = m.code
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;"><tr>
        <td bgcolor="${C.cream}" style="padding:14px 24px;border:1px solid ${C.gold};border-radius:12px;font-family:Menlo,Consolas,'Courier New',monospace;font-size:${long ? 22 : 32}px;font-weight:700;letter-spacing:${long ? '0.06em' : '0.3em'};color:${C.brandDeep};">${escape(m.code)}</td>
      </tr></table>`
    : '';
  // The image once, in the Amharic section (both sections are one email).
  const image =
    m.image && lang === 'am'
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
        <td bgcolor="#FFFFFF" style="padding:12px;border:1px solid ${C.edge};border-radius:12px;"><img src="cid:${escape(m.image.cid)}" width="200" height="200" alt="${escape(m.image.alt)}" style="display:block;width:200px;height:200px;"></td>
      </tr></table>`
      : '';
  return `<div lang="${lang}">
    <h1 style="margin:0 0 16px;font-family:${FONT};font-size:21px;line-height:1.35;font-weight:700;color:${C.brandDeep};">${escape(tr(m.title))}</h1>
    ${m.paragraphs.map((s) => p(s)).join('')}
    ${button}
    ${code}
    ${image}
    ${(m.notes ?? []).map((s) => p(s, C.inkMuted, 13)).join('')}
  </div>`;
}

function html(m: Message): string {
  const link = m.action
    ? `<tr><td style="padding:0 32px 24px;">
        <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.inkMuted};">${escape(am('If the button does not work, copy this link into your browser:'))}<br>${escape('If the button does not work, copy this link into your browser:')}</p>
        <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escape(m.action.url)}" target="_blank" style="color:${C.brand};">${escape(m.action.url)}</a></p>
      </td></tr>`
    : '';
  return `<!doctype html>
<html lang="am">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(am(m.subject))} · ${escape(m.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:24px 12px;">
  <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border:1px solid ${C.edge};border-radius:14px;">
    <tr><td bgcolor="${C.brand}" style="padding:20px 32px;border-radius:14px 14px 0 0;border-bottom:3px solid ${C.gold};">
      <p style="margin:0;font-family:${FONT};font-size:18px;font-weight:700;color:${C.cream};">${escape(am('Felege Yordanos Sunday School'))}</p>
      <p style="margin:2px 0 0;font-family:${FONT};font-size:12px;letter-spacing:0.04em;color:${C.goldLight};">Felege Yordanos Sunday School</p>
    </td></tr>
    <tr><td style="padding:28px 32px 8px;">${htmlSection('am', m)}</td></tr>
    <tr><td style="padding:0 32px;"><div style="border-top:1px solid ${C.edge};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
    <tr><td style="padding:24px 32px 8px;">${htmlSection('en', m)}</td></tr>
    ${link}
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
  <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.inkMuted};text-align:center;">${escape(am('This is an automated message. Please do not reply.'))}<br>This is an automated message. Please do not reply.</p>
</td></tr>
</table>
</body>
</html>`;
}

function textSection(tr: (s: string) => string, m: Message): string {
  return [
    tr(m.title),
    ...m.paragraphs.map(tr),
    m.action ? `${tr(m.action.label)}:\n${m.action.url}` : '',
    m.code ? `    ${m.code}` : '',
    ...(m.notes ?? []).map(tr),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function text(m: Message): string {
  return [
    `${am('Felege Yordanos Sunday School')} · Felege Yordanos Sunday School`,
    textSection(am, m),
    '────────────',
    textSection((s) => s, m),
    '────────────',
    `${am('This is an automated message. Please do not reply.')}\nThis is an automated message. Please do not reply.`,
  ].join('\n\n');
}

function render(m: Message): EmailContent {
  return {
    subject: `${am(m.subject)} · ${m.subject}`,
    text: text(m),
    html: html(m),
  };
}

/** Password reset link (Better Auth, lib/auth.ts). The link is valid 1 hour. */
export function passwordResetEmail({ url }: { url: string }): EmailContent {
  return render({
    subject: 'Reset your password',
    title: 'Reset your password',
    paragraphs: [
      'We received a request to reset the password for your account.',
      'Tap the button below to choose a new password. The link is valid for 1 hour.',
    ],
    action: { label: 'Choose a new password', url },
    notes: [
      'If you did not ask for this, you can ignore this email. Your password stays the same.',
    ],
  });
}

/**
 * 6-digit email verification code (Better Auth Email OTP, lib/auth.ts).
 * The code is valid 10 minutes (CODE_EXPIRES_IN in lib/email-verification.ts).
 * The code leads the subject, so it shows in the inbox preview.
 */
export function verificationCodeEmail({
  code,
}: {
  code: string;
}): EmailContent {
  const content = render({
    subject: 'Verification code',
    title: 'Verify your email',
    paragraphs: [
      'Enter this code in the app to verify your email address. The code is valid for 10 minutes.',
    ],
    code,
    notes: ['If you did not create an account, you can ignore this email.'],
  });
  return {
    ...content,
    subject: `${code} · ${am('Verification code')} / Verification code`,
  };
}

/**
 * A pre-member was approved: their ID and check-in QR (inline image, cid
 * "qr"; the caller attaches the PNG). Sent to the email on the record.
 */
export function preMemberApprovedEmail({
  code,
}: {
  code: string;
}): EmailContent {
  return render({
    subject: 'Your pre-member ID',
    title: 'Welcome to Felege Yordanos Sunday School',
    paragraphs: [
      'Your registration as a pre-member (ቅድመ አባል) has been approved. This is your ID:',
    ],
    code,
    image: { cid: 'qr', alt: code },
    notes: [
      'Show this QR code at the door to check in. You can also sign up in the app and link your account with this ID.',
    ],
  });
}

/** A pre-member was promoted: they are a member now, with their SSU ID. */
export function promotedToMemberEmail({
  memberId,
}: {
  memberId: string;
}): EmailContent {
  return render({
    subject: "You're now a member",
    title: "You're now a member",
    paragraphs: [
      'You are now a registered member of the Sunday School. This is your member ID:',
    ],
    code: memberId,
    notes: [
      'From now on please use your member QR code to check in. Your pre-member QR no longer works.',
    ],
  });
}
