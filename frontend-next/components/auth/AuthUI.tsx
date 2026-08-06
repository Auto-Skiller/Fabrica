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

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'facebook') => {
    if (!supabaseClient) {
      setMessage({ text: 'Supabase client is not initialized. Please verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.', isError: true });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const redirectUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined);
      let scopes = '';
      if (provider === 'facebook') {
        scopes = 'email,public_profile';
      }
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          scopes: scopes || undefined,
          skipBrowserRedirect: true,
        }
      });
      if (error) throw error;

      if (data?.url) {
        if (isIframe) {
          setMessage({ text: 'Opening authentication window... If blocked, please open this app in a New Tab.', isError: false });
          const pop = window.open(data.url, '_blank');
          if (!pop) {
            window.top!.location.href = data.url;
          }
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message || `Authentication error with ${provider}`, isError: true });
      setLoading(false);
    }
  };

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
      {/* OAuth SSO Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          type="button"
          onClick={() => handleOAuthSignIn('google')}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            color: '#1C1C1E',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthSignIn('github')}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: '#1C1C1E',
            border: '1px solid #1C1C1E',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          <span>Continue with GitHub</span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthSignIn('facebook')}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: '#1877F2',
            border: '1px solid #1877F2',
            borderRadius: '8px',
            color: '#ffffff',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span>Continue with Facebook</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>or use secure email</span>
        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
      </div>

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
