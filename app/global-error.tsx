'use client';

/**
 * Last-resort boundary: catches failures in the root layout itself, which is
 * why it has to render its own <html> and <body> and cannot use any of the
 * app's components or styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#0B0C0D',
          color: '#EDEDEF',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: '2rem 1.25rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem' }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: '#7C7F86', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
            تعذّر تحميل الموقع. يرجى المحاولة مرة أخرى.
          </p>
          {error.digest && (
            <p style={{ color: '#565961', fontSize: '0.75rem', direction: 'ltr' }}>
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              height: '3rem',
              padding: '0 1.75rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#6B1F2E',
              color: '#fff',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
