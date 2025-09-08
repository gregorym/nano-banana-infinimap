import { TRPCReactProvider } from "@/trpc/react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinimap",
  description: "Generative, neighbor-aware slippy map",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
