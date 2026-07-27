'use client';

export const dynamic = 'force-static';

export default function GlobalError({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
}) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#070a13',
        color: '#ffffff',
        margin: 0,
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Application Error</h2>
        <p style={{ color: '#94a3b8' }}>An unexpected error occurred.</p>
        {reset && (
          <button
            onClick={() => reset()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        )}
      </body>
    </html>
  );
}
