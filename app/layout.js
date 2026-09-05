import './globals.css';

export const metadata = {
  title: 'Profile Rewriter',
  description:
    'Paste your Upwork title and overview to get them checked against the Profile Builder framework and rewritten where weak.',
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
