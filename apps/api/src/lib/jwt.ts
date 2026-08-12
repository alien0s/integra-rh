import { createHmac, timingSafeEqual } from "node:crypto";

import { getApiConfig } from "../plugins/env.js";
import type { AuthUser } from "../types/auth.js";

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

interface JwtPayload extends AuthUser {
  iat: number;
  exp: number;
}

const jwtHeader: JwtHeader = {
  alg: "HS256",
  typ: "JWT"
};

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parseExpiresIn(value: string) {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());

  if (!match) {
    return 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  };

  return amount * unitSeconds[unit];
}

function getJwtSecret() {
  return getApiConfig().jwt.secret;
}

export function signAuthToken(user: AuthUser) {
  const config = getApiConfig();
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    ...user,
    iat: issuedAt,
    exp: issuedAt + parseExpiresIn(config.jwt.expiresIn)
  };
  const unsignedToken = `${encodeJson(jwtHeader)}.${encodeJson(payload)}`;
  const signature = signValue(unsignedToken, config.jwt.secret);

  return `${unsignedToken}.${signature}`;
}

export function verifyAuthToken(token: string): AuthUser {
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Token malformado");
  }

  const header = decodeJson<JwtHeader>(encodedHeader);

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Token inválido");
  }

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signValue(unsignedToken, getJwtSecret());

  if (!safeEquals(signature, expectedSignature)) {
    throw new Error("Assinatura inválida");
  }

  const payload = decodeJson<JwtPayload>(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp <= now) {
    throw new Error("Token expirado");
  }

  return {
    id: payload.id,
    email: payload.email,
    nome: payload.nome,
    departamento: payload.departamento,
    funcao: payload.funcao,
    avatar: payload.avatar,
    papelCodigo: payload.papelCodigo,
    personificadoPor: payload.personificadoPor
  };
}
