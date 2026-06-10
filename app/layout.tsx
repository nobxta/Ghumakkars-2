import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ScrollToTop from "@/components/ScrollToTop";
import ConditionalFooter from "@/components/ConditionalFooter";

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ghumakkars.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ghumakkars - Budget Group Travel Across India | Explore India",
    template: "%s | Ghumakkars",
  },
  description:
    "Curated budget-friendly group trips across India — Manali, Goa, Rishikesh, Kashmir & more. Book with seat-lock, earn referral rewards, and travel with a crew that gets it.",
  keywords: [
    "budget travel India",
    "group trips India",
    "cheap trips Manali",
    "Goa group trip",
    "Rishikesh adventure trip",
    "Kashmir budget tour",
    "affordable travel packages India",
    "backpacking India",
    "Ghumakkars",
    "seat lock booking",
    "group adventure India",
    "budget adventure trips",
    "best group travel company India",
    "weekend getaway India",
    "travel with friends India",
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
    title: "Ghumakkars - Budget Group Travel Across India",
    description:
      "Curated budget-friendly group trips across India. Manali, Goa, Rishikesh, Kashmir & more. Book now with seat-lock option!",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Ghumakkars - Budget Group Travel India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ghumakkars - Budget Group Travel Across India",
    description:
      "Budget group trips to Manali, Goa, Rishikesh & more. Book with seat-lock!",
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
      "Curated budget-friendly group trips across India. Real adventures, honest prices, unforgettable experiences.",
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
      audienceType: "Budget Travellers",
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
      <body className={`${inter.className} ${playfair.variable} antialiased`}>
        <Navbar />
        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
        <ConditionalFooter />
        <ScrollToTop />
      </body>
    </html>
  );
}
