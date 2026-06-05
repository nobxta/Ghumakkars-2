import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ghumakkars.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ghumakkars - Premium Budget Travel for Students | Explore India",
    template: "%s | Ghumakkars",
  },
  description:
    "India's #1 student travel platform. Curated budget-friendly trips across India — Manali, Goa, Rishikesh, Kashmir & more. Book group trips with seat-lock, earn referral rewards, and travel with like-minded students.",
  keywords: [
    "student travel India",
    "budget trips for college students",
    "group travel India",
    "cheap trips Manali",
    "student trips Goa",
    "Rishikesh adventure trip",
    "Kashmir budget tour",
    "university trip packages",
    "backpacking India students",
    "Ghumakkars",
    "seat lock booking",
    "college trip organizer",
    "youth travel India",
    "affordable adventure trips",
    "student tour packages 2025",
  ],
  authors: [{ name: "Ghumakkars", url: siteUrl }],
  creator: "Ghumakkars",
  publisher: "Ghumakkars",
  formatDetection: { telephone: true, email: true, address: false },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "Ghumakkars",
    title: "Ghumakkars - Premium Budget Travel for Students",
    description:
      "Curated budget-friendly trips across India for university students. Manali, Goa, Rishikesh, Kashmir & more. Book now with seat-lock option!",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Ghumakkars - Student Travel Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ghumakkars - Premium Budget Travel for Students",
    description:
      "India's #1 student travel platform. Budget trips to Manali, Goa, Rishikesh & more.",
    images: [`${siteUrl}/og-image.png`],
    creator: "@ghumakkars",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: { canonical: siteUrl },
  category: "travel",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "Ghumakkars",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description:
      "India's #1 student travel platform offering curated budget-friendly trips across India for university students.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
    },
    sameAs: [
      "https://instagram.com/ghumakkars",
    ],
    priceRange: "₹₹",
    areaServed: { "@type": "Country", name: "India" },
    audience: {
      "@type": "Audience",
      audienceType: "University Students",
    },
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Navbar />
        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
        <Footer />
        <BottomNav />
        <ScrollToTop />
      </body>
    </html>
  );
}
