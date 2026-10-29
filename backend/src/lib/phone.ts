/** Só os números do telefone, sem o 55 do Brasil: "(75) 99999-9999" e "+55 75 99999-9999" viram "75999999999". */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits
}

export function samePhone(a: string, b: string): boolean {
  const x = normalizePhone(a)
  const y = normalizePhone(b)
  return x.length > 0 && x === y
}
