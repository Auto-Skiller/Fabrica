import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabrica — Watch your company get built.",
  description: "AI knows HOW to build. It just doesn't know WHAT. Drop in your spreadsheets, files, and processes — Fabrica learns how your business works and builds real systems to run it on.",
};

const safeFetchScript = `
(function() {
  try {
    var win = typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : null);
    if (!win) return;

    var _currentFetch = win.fetch;
    var fetchGetter = function() { return _currentFetch; };
    var fetchSetter = function(v) { _currentFetch = v; };

    var targets = [
      win,
      typeof Window !== 'undefined' ? Window.prototype : null,
      typeof self !== 'undefined' ? self : null,
      typeof globalThis !== 'undefined' ? globalThis : null
    ];

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t) continue;
      try {
        Object.defineProperty(t, 'fetch', {
          get: fetchGetter,
          set: fetchSetter,
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        try {
          Object.defineProperty(t, 'fetch', {
            value: _currentFetch,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } catch (e2) {}
      }
    }
  } catch (err) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script key="safe-fetch-script" id="safe-fetch-script" dangerouslySetInnerHTML={{ __html: safeFetchScript }} />
        {children}
      </body>
    </html>
  );
}



