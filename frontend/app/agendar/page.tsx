import type { Metadata } from 'next'
import PublicBooking from '@/components/public-booking'

export const metadata: Metadata = {
  title: 'Agende seu horário | Gilvane Nails',
  description: 'Escolha o serviço, o dia e o horário e envie seu pedido de agendamento.',
}

export default function Page() {
  return <PublicBooking />
}
