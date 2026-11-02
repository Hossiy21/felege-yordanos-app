import 'server-only';
import nodemailer from 'nodemailer';

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Inline images, referenced in the HTML as src="cid:<cid>". */
  attachments?: { filename: string; content: Buffer; cid: string }[];
}

/**
 * EMAIL_TRANSPORT
 * - console: print the email in the server log, send nothing. Default outside
 *   production (development, tests, the CI smoke test).
 * - smtp: send through SMTP_HOST (Brevo on staging and production, Mailpit for
 *   local testing). Default in production.
 */
type Transport = 'console' | 'smtp';

function transportName(): Transport {
  const value =
    process.env['EMAIL_TRANSPORT'] ||
    (process.env['NODE_ENV'] === 'production' ? 'smtp' : 'console');
  if (value !== 'console' && value !== 'smtp') {
    throw new Error(
      `EMAIL_TRANSPORT must be "console" or "smtp", got "${value}".`,
    );
  }
  return value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`EMAIL_TRANSPORT=smtp needs ${name}, which is not set.`);
  }
  return value;
}

// A local SMTP catcher (Mailpit) has no login and no TLS.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/;

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
let from: string | undefined;

/** One SMTP transporter, created on first use and reused. */
function smtp() {
  if (!transporter) {
    const host = required('SMTP_HOST');
    const port = Number(required('SMTP_PORT'));
    const local = LOCAL_HOST.test(host);
    from = required('EMAIL_FROM');
    transporter = nodemailer.createTransport({
      host,
      port,
      // 465 is TLS from the start; 587 (Brevo) upgrades with STARTTLS, which
      // is required so the login and the message are never sent in clear.
      secure: port === 465,
      requireTLS: !local && port !== 465,
      ignoreTLS: local,
      auth: local
        ? undefined
        : { user: required('SMTP_USER'), pass: required('SMTP_PASSWORD') },
      // A password reset request waits for the email, so never hang for long.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return { transporter, from: from as string };
}

/**
 * Sends an email. Throws when sending fails; the error is logged without the
 * message body, so codes and links never end up in the logs.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (transportName() === 'console') {
    console.log(
      `\n──── Email (not sent, EMAIL_TRANSPORT=console) ────\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n${(email.attachments ?? []).map((a) => `[image ${a.filename}]\n`).join('')}───────────────────────────────\n`,
    );
    return;
  }

  try {
    const { transporter, from } = smtp();
    await transporter.sendMail({ from, ...email });
  } catch (err) {
    const e = err as { code?: string; responseCode?: number; message?: string };
    console.error(
      `[email] sending "${email.subject}" failed: ${e.code ?? ''} ${e.responseCode ?? ''} ${e.message ?? String(err)}`,
    );
    throw err;
  }
}
