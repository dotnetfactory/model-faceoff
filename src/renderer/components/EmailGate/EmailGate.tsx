/**
 * EmailGate - Email capture and verification prompt
 *
 * Step 1 collects the address, step 2 confirms the 6-digit code we email out.
 */

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import './EmailGate.css';

interface EmailGateProps {
  onVerified: (email: string) => void;
  onDismiss: () => void;
}

// The server refuses another send within 60s of the last one
const RESEND_COOLDOWN_SECONDS = 60;

export function EmailGate({ onVerified, onDismiss }: EmailGateProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    const address = email.trim();
    setBusy(true);
    setError(null);

    const result = await window.api.activation.start(address);
    setBusy(false);

    if (!result.success) {
      setError(result.error?.message || 'Failed to send the code.');
      return;
    }

    if (result.data?.alreadyVerified) {
      onVerified(address);
      return;
    }

    // A resend invalidates whatever was typed against the previous code
    setCode('');
    setStep('code');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    sendCode();
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    setBusy(true);
    setError(null);

    const result = await window.api.activation.confirm(address, code);
    setBusy(false);

    if (!result.success) {
      setError(result.error?.message || 'Failed to verify the code.');
      return;
    }

    onVerified(address);
  };

  return (
    <div className="email-gate-overlay">
      <div className="email-gate-panel">
        <h2 className="email-gate-title">Model Faceoff is free and open source.</h2>
        <p className="email-gate-text">
          Tell us where to reach you and we&apos;ll let you know when something big ships.
        </p>
        <p className="email-gate-note">
          We&apos;ll email you occasionally about major updates - no spam, and you can unsubscribe any time.
        </p>

        {step === 'email' ? (
          <form className="email-gate-form" onSubmit={handleSubmitEmail}>
            <label htmlFor="email-gate-address">Email address</label>
            <input
              id="email-gate-address"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
            />

            {error && <p className="email-gate-error">{error}</p>}

            <div className="email-gate-actions">
              <button type="submit" className="primary-button" disabled={busy || !email.trim()}>
                {busy ? (
                  <>
                    <Loader2 size={14} className="spinning" />
                    Sending...
                  </>
                ) : (
                  'Verify email'
                )}
              </button>
              <button type="button" className="btn-secondary" onClick={onDismiss} disabled={busy}>
                Maybe later
              </button>
            </div>
          </form>
        ) : (
          <form className="email-gate-form" onSubmit={handleSubmitCode}>
            <label htmlFor="email-gate-code">
              Enter the 6-digit code we sent to <strong>{email.trim()}</strong>
            </label>
            <input
              id="email-gate-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="email-gate-code-input"
              disabled={busy}
            />

            {error && <p className="email-gate-error">{error}</p>}

            <div className="email-gate-actions">
              <button type="submit" className="primary-button" disabled={busy || code.length !== 6}>
                {busy ? (
                  <>
                    <Loader2 size={14} className="spinning" />
                    Verifying...
                  </>
                ) : (
                  'Verify email'
                )}
              </button>
              <button type="button" className="btn-secondary" onClick={onDismiss} disabled={busy}>
                Maybe later
              </button>
            </div>

            <button type="button" className="email-gate-resend" onClick={sendCode} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
