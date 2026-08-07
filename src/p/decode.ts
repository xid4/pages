// Utilidades de desofuscação compartilhadas (parâmetros `u` e `p`).

export function reverseString(value: string): string | null {
  try {
    return Array.from(value).reverse().join("");
  } catch {
    return null;
  }
}

export function startsWithHttp(value: string): boolean {
  try {
    return /^https?:\/\//i.test(value.trim());
  } catch {
    return false;
  }
}

export function decodeBase64(value: string): string | null {
  try {
    // Aceita Base64 tradicional e Base64 URL-safe.
    let normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
    normalized += "=".repeat((4 - (normalized.length % 4)) % 4);

    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  } catch {
    return null;
  }
}
