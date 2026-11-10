import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '../_components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy · የግላዊነት ፖሊሲ — Felege Yordanos Sunday School',
  description:
    'How the Felege Yordanos Sunday School app collects, uses and protects member information.',
};

const SECTIONS: LegalSection[] = [
  {
    title: 'Who we are',
    blocks: [
      'This app is run by Felege Yordanos Sunday School (ፈለገ ዮርዳኖስ ሰንበት ትምህርት ቤት), which serves under Bole Debre Salem Medhane Alem Metmeke Melekot Kidus Yohannes We Abune Aregawi Cathedral (ቦሌ ደብረ ሳሌም መድኃኔዓለም መጥምቀ መለኰት ቅዱስ ዮሐንስ ወ አቡነ አረጋዊ ካቴድራል) of the Ethiopian Orthodox Tewahedo Church.',
      'For any question about your data, write to privacy@felegeyordanos.org.',
    ],
  },
  {
    title: 'What we collect',
    blocks: [
      'We collect only what the Sunday School needs:',
      [
        'Account: your name, email address and password. The password is stored only in hashed form, so nobody can read it. When you sign in, we store the session with your IP address and browser type.',
        "Member record: the membership details the Sunday School register already holds and links to your account: names (including father's, grandfather's and mother's names, and baptismal name), gender, birth date, marital status, church of baptism, address and phone numbers, education, work, service and award history.",
        'Attendance: whether you were present, late or absent at services and events.',
        'Songbook: the songs you open and when you last opened each one, so we can show your recent songs.',
        'Donations: the amount, payment method, notes, the receipt image you upload, and whether the donation was verified or rejected.',
        'Google sign-in (coming soon): if you choose to sign in with Google, we receive your name, email address and profile picture from your Google account (the openid, email and profile scopes only). We never receive your Google password.',
      ],
    ],
  },
  {
    title: 'How we use it',
    blocks: [
      [
        'To run the Sunday School: membership, attendance, events, notices, the songbook and donations.',
        'To keep your account secure, with sign-in sessions and verification codes.',
        'To send service emails, such as verification codes and password reset links. We do not send marketing emails.',
      ],
    ],
  },
  {
    title: 'Who can see it',
    blocks: [
      [
        'You can see your own account, member record, attendance and donations.',
        "Department heads see what they need for their department's work, such as attendance at their events.",
        'Heads of the Budget & Asset Management department see donations and receipts in order to verify them.',
        "The Sunday School's admins (the tech team) can see all data in order to run and support the app.",
      ],
      'We never sell your data, we show no ads, and we use no tracking or analytics cookies.',
    ],
  },
  {
    title: 'Cookies',
    blocks: [
      'We use two cookies: a session cookie that keeps you signed in, and fy-lang, which remembers your language. Your browser also remembers your theme and sidebar choice on your device; that is not sent to us.',
    ],
  },
  {
    title: 'Service providers',
    blocks: [
      'We use a few providers to run the app. They handle data only to provide their service to us:',
      [
        "Our rented server, which stores the app's data and the nightly backups.",
        'Cloudflare, which protects the website, delivers it over a secure connection, and keeps uploaded files (such as donation receipts) in private storage.',
        'Brevo, which sends our emails.',
        'Google, only if you choose to sign in with Google.',
      ],
    ],
  },
  {
    title: 'Google user data',
    blocks: [
      "Information we receive from Google is used only to sign you in and to create or link your account. It is not shared with third parties, not used for advertising, and not sold. The app's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.",
    ],
  },
  {
    title: 'How long we keep it',
    blocks: [
      [
        'Account data: while your account exists.',
        'Member register records: as long as the Sunday School needs them for its membership records.',
        'Backups: kept for 14 days, then deleted.',
      ],
    ],
  },
  {
    title: 'Your rights',
    blocks: [
      'You can ask to see, correct or delete your data, or to delete your account, by emailing privacy@felegeyordanos.org.',
    ],
  },
  {
    title: 'Children',
    blocks: [
      "Members of any age may have an account; a parent's or guardian's consent is not required. We treat children's data with the same care and limits as everyone else's. Parents and guardians can contact us about their child's data at privacy@felegeyordanos.org.",
    ],
  },
  {
    title: 'Changes to this policy',
    blocks: [
      'If we change this policy, we will update this page and the effective date at the top.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      sub="How the Felege Yordanos Sunday School app handles your information."
      sections={SECTIONS}
    />
  );
}
