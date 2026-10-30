import { Suspense } from 'react'
import type { Metadata } from 'next'
import ManageBooking from '@/components/manage-booking'

export const metadata: Metadata = {
  title: 'Meu horário | Gilvane Nails',
  description: 'Remarque ou cancele o seu horário.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageBooking />
    </Suspense>
  )
}
