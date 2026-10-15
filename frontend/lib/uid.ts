/** crypto.randomUUID só existe em HTTPS/localhost; este funciona em qualquer endereço. */
export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
}
