/** Cryptographic random string from a caller-owned alphabet (no lookalikes). */
export function randomCode(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
