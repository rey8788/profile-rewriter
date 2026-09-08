import './globals.css';

export const metadata = {
  title: 'Upwork Freelancer Toolkit',
  description:
    'Scan your Upwork profile for completeness, rewrite your title and overview against the Profile Builder framework, match yourself to a job post, and get a proposal written for you.',
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
