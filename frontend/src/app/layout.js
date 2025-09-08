export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>MediaNest</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
