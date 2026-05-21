import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ChatPay Listener',
  description: 'Wayl Instagram webhook listener',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
