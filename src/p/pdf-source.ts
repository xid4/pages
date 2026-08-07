import { reverseString, startsWithHttp, decodeBase64 } from "./decode";

function validatePdfUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("A URL encontrada não é válida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Somente URLs HTTP ou HTTPS são permitidas.");
  }

  return parsed.href;
}

/**
 * Resolve a fonte do PDF (parâmetro `u`) aceitando URL direta, invertida,
 * Base64 ou invertida em Base64. Devolve a primeira que aponta para HTTP/HTTPS.
 */
export function resolvePdfSource(value: string): string {
  if (!value) {
    throw new Error("Informe o PDF");
  }

  const reversed = reverseString(value);
  const candidates: Array<{ description: string; value: string | null }> = [
    { description: "URL direta", value },
    { description: "string invertida", value: reversed },
    { description: "Base64", value: decodeBase64(value) },
    { description: "string invertida em Base64", value: reversed ? decodeBase64(reversed) : null },
    { description: "string Base64 em invertida", value: reverseString(decodeBase64(value) ?? "") },
  ];

  for (const candidate of candidates) {
    if (candidate.value && startsWithHttp(candidate.value)) {
      // console.info(`PDF identificado por: ${candidate.description}`);
      return validatePdfUrl(candidate.value);
    }
  }

  throw new Error(
    "O parâmetro 'u' não contém uma URL HTTP/HTTPS direta, invertida, codificada em Base64 ou invertida e codificada em Base64.",
  );
}
