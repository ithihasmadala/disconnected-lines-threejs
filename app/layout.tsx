import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Line2 Performance Comparison - Single vs Multiple Objects',
  description: 'Performance comparison between single Line2 object vs multiple Line2 objects for rendering 5000+ interactive lines. Real-time editing, dynamic point manipulation, and performance monitoring.',
  keywords: 'Three.js, Line2, performance comparison, WebGL, 3D graphics, interactive lines, React Three Fiber, rendering optimization',
  authors: [{ name: 'Line2 Performance Comparison' }],
  creator: 'Line2 Performance Comparison',
  publisher: 'Line2 Performance Comparison',
  robots: 'index, follow',
  openGraph: {
    title: 'Line2 Performance Comparison - Single vs Multiple Objects',
    description: 'Performance comparison between single Line2 object vs multiple Line2 objects for rendering 5000+ interactive lines',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Line2 Performance Comparison - Single vs Multiple Objects',
    description: 'Performance comparison between single Line2 object vs multiple Line2 objects for rendering 5000+ interactive lines',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="antialiased bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  )
}
