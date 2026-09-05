import './globals.css';

export const metadata = {
  title: 'Title & Overview Rewriter',
  description:
    'Check your Upwork title and overview against the Profile Builder framework and get the weak parts rewritten, using only what you gave it.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
