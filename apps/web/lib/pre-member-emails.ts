/**
 * Emails to pre-members: approval (ID and QR) and promotion. Sent after the
 * change is saved; a failed email is logged and reported, never undoes it.
 */
import 'server-only';
import QRCode from 'qrcode';
import { sendEmail } from './email';
import {
  preMemberApprovedEmail,
  promotedToMemberEmail,
} from './email-templates';

/** Same look as the in-app QR: dark on light, error correction H. */
const qrPng = (value: string) =>
  QRCode.toBuffer(value, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: { dark: '#072B26', light: '#FFFFFF' },
  });

/** Returns whether the email was sent (false: no address, or it failed). */
export async function sendPreMemberApprovedEmail(
  to: string | null,
  code: string,
): Promise<boolean> {
  if (!to) return false;
  try {
    await sendEmail({
      to,
      ...preMemberApprovedEmail({ code }),
      attachments: [
        { filename: `${code}.png`, content: await qrPng(code), cid: 'qr' },
      ],
    });
    return true;
  } catch (err) {
    console.error(
      '[pre-members] approval email failed:',
      (err as Error).message,
    );
    return false;
  }
}

export async function sendPromotedEmail(
  to: string | null,
  memberId: string,
): Promise<boolean> {
  if (!to) return false;
  try {
    await sendEmail({ to, ...promotedToMemberEmail({ memberId }) });
    return true;
  } catch (err) {
    console.error(
      '[pre-members] promotion email failed:',
      (err as Error).message,
    );
    return false;
  }
}
