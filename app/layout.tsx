import type { Metadata } from 'next'
import { Fira_Code } from 'next/font/google'
import './globals.css'

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-fira-code',
})

export const metadata: Metadata = {
  title: 'Voyager — Portfolio Intelligence',
  description: 'Private, AI-powered portfolio intelligence. To the moon and beyond.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={firaCode.variable}>
      <body>{children}</body>
    </html>
  )
}
