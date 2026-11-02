'use client';

import { useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { Turnstile } from '@/components/turnstile';
import { useT } from '@/lib/i18n/client';
import {
  PRE_MEMBER_FIELD_LABEL,
  PRE_MEMBER_FIELDS,
  type PreMemberField,
} from '@/lib/pre-member-schema';
import { REGISTRATION_CLOSED } from '@/lib/registration-sessions';
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthFrame,
  AuthHeading,
} from '../_components/auth-ui';
import { submitRegistration } from './actions';

const INPUT: Record<
  PreMemberField,
  React.InputHTMLAttributes<HTMLInputElement>
> = {
  name: { autoComplete: 'given-name', maxLength: 60 },
  fatherName: { autoComplete: 'off', maxLength: 60 },
  grandfatherName: { autoComplete: 'off', maxLength: 60 },
  email: {
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
    maxLength: 254,
  },
  phone: {
    type: 'tel',
    inputMode: 'tel',
    autoComplete: 'tel',
    maxLength: 20,
    placeholder: '09…',
  },
};

const EMPTY: Record<PreMemberField, string> = {
  name: '',
  fatherName: '',
  grandfatherName: '',
  email: '',
  phone: '',
};

/**
 * The self-registration form (all five fields required) with Turnstile.
 * `sessionToken` null = the session is closed, expired or unknown.
 */
export function JoinForm({
  sessionToken,
  siteKey,
}: {
  sessionToken: string | null;
  siteKey: string | null;
}) {
  const t = useT();
  const [values, setValues] = useState(EMPTY);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [closed, setClosed] = useState(!sessionToken || !siteKey);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken || !captcha) {
      setError(t('Please complete the check that you are not a robot.'));
      return;
    }
    setBusy(true);
    setError('');
    const res = await submitRegistration({
      ...values,
      sessionToken,
      turnstileToken: captcha,
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setReference(res.data.reference);
      return;
    }
    const message =
      res?.ok === false ? res.error : 'Something went wrong. Please try again.';
    if (message === REGISTRATION_CLOSED) setClosed(true);
    setError(t(message));
    // A Turnstile token works once.
    setResetKey((k) => k + 1);
  }

  if (closed) {
    return (
      <AuthFrame>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 rounded-full border border-gold/30 bg-gold/10 p-3 text-gold-deep">
            <Lock className="h-5 w-5" />
          </div>
          <p className="font-ethiopic text-[17px] font-semibold text-brand-ink">
            ምዝገባው ተዘግቷል። እባክዎ በጠረጴዛው ያሉትን አገልጋዮች ይጠይቁ።
          </p>
          <p className="mt-2 text-[13px] text-ink-muted">
            {REGISTRATION_CLOSED}
          </p>
        </div>
      </AuthFrame>
    );
  }

  if (reference) {
    return (
      <AuthFrame>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 rounded-full bg-status-present-bg p-3 text-status-present">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="font-ethiopic text-[22px] font-semibold text-brand-ink">
            {t('Thank you!')}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
            {t(
              'A volunteer will confirm your registration. You will get your ID by email.',
            )}
          </p>
          <div className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
              {t('Your reference')}
            </div>
            <div className="mt-1 font-mono text-[22px] font-bold tracking-[0.08em] text-brand-ink">
              {reference}
            </div>
          </div>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <AuthHeading
        en={['Pre-member', 'registration']}
        am={['ቅድመ አባል', 'ምዝገባ']}
        sub={t(
          'For people learning at the Sunday School who are not registered members yet.',
        )}
      />
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {PRE_MEMBER_FIELDS.map((f) => (
          <AuthField
            key={f}
            label={t(PRE_MEMBER_FIELD_LABEL[f])}
            required
            value={values[f]}
            onChange={(e) => setValues({ ...values, [f]: e.target.value })}
            {...INPUT[f]}
          />
        ))}
        {siteKey && (
          <Turnstile
            siteKey={siteKey}
            onToken={setCaptcha}
            resetKey={resetKey}
          />
        )}
        {error && <AuthError>{error}</AuthError>}
        <AuthButton am="ይመዝገቡ" disabled={busy || !captcha}>
          {busy ? t('Sending…') : t('Register')}
        </AuthButton>
      </form>
    </AuthFrame>
  );
}
