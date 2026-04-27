import { Geist, Geist_Mono } from "next/font/google"

import localfont from "next/font/local";
import { Providers } from "@/components/providers"

import "allotment/dist/style.css"
import "@workspace/ui/globals.css"

const MatterFont = localfont({
  src: [
    {
      path: "../public/font/Matter-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/Matter-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/font/Matter-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/font/Matter-Black.woff2",
      weight: "900",
      style: "italic",
    },
  ],
  variable: "--font-sans",
});

const MatterFontMono = localfont({
  src: [
    {
      path: "../public/font/MatterMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/MatterMono-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/font/MatterMono-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${MatterFont.variable} ${MatterFontMono.variable} font-sans antialiased `}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
