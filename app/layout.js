import './globals.css';

export const metadata = {
  title: 'Street Map — Marketing Planner',
  description: 'Metro-style map of streets, shops and commission shares',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
