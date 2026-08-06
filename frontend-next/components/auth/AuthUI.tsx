'use client';

import React, { useState } from 'react';

export const ThemeSupa = {};

export interface AuthProps {
  supabaseClient: any;
  appearance?: any;
  theme?: string;
  providers?: string[];
  redirectTo?: string;
}

export function Auth({ supabaseClient, redirectTo }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseClient) return;
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo
          }
        });
        if (error) throw error;
        setMessage({ text: 'Verification email sent! Please check your inbox.', isError: false });
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        setMessage({ text: 'Signed in successfully!', isError: false });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Authentication error', isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => { setIsSignUp(false); setMessage(null); }}
          style={{
            flex: 1,
            background: !isSignUp ? '#CC7A4A' : 'transparent',
            color: !isSignUp ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setIsSignUp(true); setMessage(null); }}
          style={{
            flex: 1,
            background: isSignUp ? '#CC7A4A' : 'transparent',
            color: isSignUp ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#1c1c1e',
              fontSize: '11px',
              padding: '8px 12px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#1c1c1e',
              fontSize: '11px',
              padding: '8px 12px',
              outline: 'none'
            }}
          />
        </div>

        {message && (
          <div style={{
            fontSize: '10.5px',
            fontWeight: 600,
            color: message.isError ? '#ef4444' : '#10b981',
            padding: '6px 8px',
            background: message.isError ? '#fef2f2' : '#ecfdf5',
            border: `1px solid ${message.isError ? '#fca5a5' : '#a7f3d0'}`,
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#CC7A4A',
            color: '#ffffff',
            border: 'none',
            fontWeight: '800',
            borderRadius: '6px',
            fontSize: '11px',
            padding: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: loading ? 'wait' : 'pointer',
            marginTop: '4px',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Processing...' : isSignUp ? 'Create Account ➔' : 'Authenticate Session ➔'}
        </button>
      </form>
    </div>
  );
}
