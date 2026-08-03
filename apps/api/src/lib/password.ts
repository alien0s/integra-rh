import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hash de senha com scrypt (node:crypto), sem dependências externas — coerente
 * com o JWT hand-rolled em lib/jwt.ts. Uso temporário para o login local por
 * e-mail + senha enquanto o Microsoft OAuth (SSO) não está configurado.
 *
 * Formato armazenado: "scrypt:<saltBase64url>:<hashBase64url>".
 */

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIXO = "scrypt";

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;

  return `${PREFIXO}:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(
  plain: string,
  armazenado: string,
): Promise<boolean> {
  const [prefixo, saltB64, hashB64] = armazenado.split(":");

  if (prefixo !== PREFIXO || !saltB64 || !hashB64) {
    return false;
  }

  const salt = Buffer.from(saltB64, "base64url");
  const esperado = Buffer.from(hashB64, "base64url");
  const derived = (await scryptAsync(plain, salt, esperado.length)) as Buffer;

  // Comparação em tempo constante (mesmo estilo de lib/jwt.ts:safeEquals).
  return (
    derived.length === esperado.length && timingSafeEqual(derived, esperado)
  );
}
