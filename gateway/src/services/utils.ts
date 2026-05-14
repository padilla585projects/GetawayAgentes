export function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
