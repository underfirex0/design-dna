import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Design DNA — Extract any design system',
  description: 'Extract the complete design DNA from any website — colors, motion, typography, components. Feed it to Claude to build something better.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a0f' }}>
        {children}
      </body>
    </html>
  );
}
