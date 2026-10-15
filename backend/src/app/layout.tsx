export const metadata = { title: 'Gilvane Nails API' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>{children}</body>
    </html>
  )
}
