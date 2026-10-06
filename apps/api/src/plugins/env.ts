export interface ApiConfig {
  nodeEnv: string;
  host: string;
  port: number;
  frontendUrl: string;
  // Quando false, a autenticação é ignorada (modo desenvolvimento).
  authEnabled: boolean;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  ldap: {
    enabled: boolean;
    url: string;
    bindDn: string;
    bindCredentials: string;
    searchBase: string;
    searchFilter: string;
    // Verificação do certificado TLS (LDAPS). Só desligue temporariamente,
    // enquanto o certificado da CA interna não está configurado — nunca deixe
    // false em produção (permite ataque man-in-the-middle).
    tlsRejectUnauthorized: boolean;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  // Banco legado SQL Server (consulta de funcionários, somente leitura).
  mssql: {
    enabled: boolean;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  microsoft: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    redirectUri: string;
  };
  // Object storage compatível com S3 (MinIO em dev/VPS, R2/S3 em prod).
  storage: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    /** URL pública para montar links de objetos (ex.: http://localhost:9000). */
    publicUrl: string;
    /** MinIO exige path-style (bucket no caminho, não subdomínio). */
    forcePathStyle: boolean;
  };
  // Leitura de diplomas/certificados por IA (upload de PDF/imagem → extrai os
  // campos de qualificacoes_* automaticamente) — ver lib/ia/leitorDiploma.ts.
  // Opcional: sem a chave, a rota correspondente responde 503 em vez de
  // quebrar o boot da API (o resto do sistema funciona normalmente sem isso).
  ia: {
    geminiApiKey: string;
    geminiModel: string;
  };
}

function readEnv(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

function readBooleanEnv(name: string, fallback = false) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

// Sem fallback de propósito: um valor padrão aqui vazaria um segredo público
// (o próprio texto deste arquivo) que qualquer um poderia usar pra forjar um
// token JWT válido (inclusive com papelCodigo "ADMIN"). Falha alto e cedo
// (na subida do processo) em vez de subir "aberto" silenciosamente.
function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. Defina-a no .env antes de subir a API.`,
    );
  }

  return value;
}

export function getApiConfig(): ApiConfig {
  return {
    nodeEnv: readEnv("NODE_ENV", "development"),
    host: readEnv("HOST", "0.0.0.0"),
    port: Number(readEnv("PORT", "3000")),
    frontendUrl: readEnv("FRONTEND_URL", "http://localhost:5173"),
    authEnabled: readBooleanEnv("AUTH_ENABLED", true),
    jwt: {
      secret: requireEnv("JWT_SECRET"),
      expiresIn: readEnv("JWT_EXPIRES_IN", "1h")
    },
    ldap: {
      enabled: readBooleanEnv("LDAP_ENABLED", false),
      url: readEnv("LDAP_URL", "ldap://localhost:389"),
      bindDn: readEnv("LDAP_BIND_DN"),
      bindCredentials: readEnv("LDAP_BIND_CREDENTIALS"),
      searchBase: readEnv("LDAP_SEARCH_BASE"),
      searchFilter: readEnv("LDAP_SEARCH_FILTER", "(mail={{email}})"),
      // Seguro por padrão: só vira false com LDAP_TLS_REJECT_UNAUTHORIZED=false.
      tlsRejectUnauthorized: readEnv("LDAP_TLS_REJECT_UNAUTHORIZED", "true") !== "false"
    },
    database: {
      host: readEnv("DB_HOST", "localhost"),
      port: Number(readEnv("DB_PORT", "5432")),
      name: readEnv("DB_NAME"),
      user: readEnv("DB_USER"),
      password: readEnv("DB_PASSWORD")
    },
    mssql: {
      enabled: readBooleanEnv("MSSQL_ENABLED", false),
      host: readEnv("MSSQL_HOST", "localhost"),
      port: Number(readEnv("MSSQL_PORT", "1433")),
      database: readEnv("MSSQL_DATABASE"),
      user: readEnv("MSSQL_USER"),
      password: readEnv("MSSQL_PASSWORD")
    },
    microsoft: {
      clientId: readEnv("MICROSOFT_CLIENT_ID"),
      clientSecret: readEnv("MICROSOFT_CLIENT_SECRET"),
      tenantId: readEnv("MICROSOFT_TENANT_ID", "common"),
      redirectUri: readEnv(
        "MICROSOFT_REDIRECT_URI",
        "http://localhost:3000/auth/microsoft/callback"
      )
    },
    storage: {
      endpoint: readEnv("S3_ENDPOINT", "http://localhost:9000"),
      region: readEnv("S3_REGION", "us-east-1"),
      accessKey: readEnv("S3_ACCESS_KEY"),
      secretKey: readEnv("S3_SECRET_KEY"),
      bucket: readEnv("S3_BUCKET", "erp-arquivos"),
      publicUrl: readEnv("S3_PUBLIC_URL", "http://localhost:9000"),
      forcePathStyle: readBooleanEnv("S3_FORCE_PATH_STYLE", true)
    },
    ia: {
      geminiApiKey: readEnv("GEMINI_API_KEY"),
      // gemini-2.5-flash-lite: o mais barato da linha atual que ainda lê
      // PDF/imagem (gemini-2.0-flash foi descontinuado pelo Google em 2026 —
      // não usar). Suporta saída JSON estruturada (responseSchema), suficiente
      // pra extrair campos de formulário de um documento. Troque via env se
      // precisar de mais qualidade (ex.: gemini-2.5-flash ou -pro) sem mexer
      // no código — conferir nomes/preços atuais em ai.google.dev antes de
      // trocar, os nomes de modelo mudam com frequência.
      geminiModel: readEnv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    }
  };
}
