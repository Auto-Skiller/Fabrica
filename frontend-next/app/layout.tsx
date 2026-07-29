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

    var _fetch = win.fetch;

    var fetchGetter = function() { return _fetch; };
    var fetchSetter = function(v) { _fetch = v; };

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
            value: _fetch,
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: safeFetchScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}


