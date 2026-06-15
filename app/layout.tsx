import type { Metadata } from 'next'
import { Inter, Newsreader, Space_Grotesk, Manrope, DM_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Editorial serif for headings/brand (Copernicus/Tiempos-like warmth) — Ember.
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
})

// Per-theme typefaces. Only the active theme's font is downloaded by the browser.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Voyager — Portfolio Intelligence',
  description: 'Private, AI-powered portfolio intelligence. To the moon and beyond.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${spaceGrotesk.variable} ${manrope.variable} ${dmSans.variable}`}
    >
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;try{var v=['ember','ion','onyx','halo','coral'];var t=localStorage.getItem('voyager:theme');if(v.indexOf(t)<0)t='ion';d.setAttribute('data-theme',t);d.setAttribute('data-anon',localStorage.getItem('voyager:anon')==='1'?'1':'0')}catch(e){d.setAttribute('data-theme','ion')}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
