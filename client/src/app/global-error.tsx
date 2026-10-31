'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang='en'>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '4rem' }}>
          <h2>Something went wrong</h2>
          <button type='button' onClick={() => reset()}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
