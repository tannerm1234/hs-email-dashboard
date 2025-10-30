import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HubSpot Email Dashboard',
  description: 'Manage automated marketing emails from HubSpot workflows',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
