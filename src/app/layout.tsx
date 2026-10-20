import type { Metadata, Viewport } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Individual Wiki",
  description: "A calm place to collect and find your notes."
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  interactiveWidget: "resizes-content"
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
