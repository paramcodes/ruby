import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Individual Wiki",
  description: "A calm place to collect and find your notes."
};

export default function RootLayout({
  children
}: Readonly<React.PropsWithChildren>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
