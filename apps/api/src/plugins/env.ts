export interface ApiConfig {
  nodeEnv: string;
  host: string;
  port: number;
  frontendUrl: string;
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
  };
  database: {
    url: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceKey: string;
  };
  microsoft: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    redirectUri: string;
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

export function getApiConfig(): ApiConfig {
  return {
    nodeEnv: readEnv("NODE_ENV", "development"),
    host: readEnv("HOST", "0.0.0.0"),
    port: Number(readEnv("PORT", "3000")),
    frontendUrl: readEnv("FRONTEND_URL", "http://localhost:5173"),
    jwt: {
      secret: readEnv("JWT_SECRET", "change-me-in-env"),
      expiresIn: readEnv("JWT_EXPIRES_IN", "1h")
    },
    ldap: {
      enabled: readBooleanEnv("LDAP_ENABLED", false),
      url: readEnv("LDAP_URL", "ldap://localhost:389"),
      bindDn: readEnv("LDAP_BIND_DN"),
      bindCredentials: readEnv("LDAP_BIND_CREDENTIALS"),
      searchBase: readEnv("LDAP_SEARCH_BASE"),
      searchFilter: readEnv("LDAP_SEARCH_FILTER", "(mail={{email}})")
    },
    database: {
      url: readEnv("DATABASE_URL"),
      supabaseUrl: readEnv("SUPABASE_URL"),
      supabaseAnonKey: readEnv("SUPABASE_ANON_KEY"),
      supabaseServiceKey: readEnv("SUPABASE_SERVICE_KEY")
    },
    microsoft: {
      clientId: readEnv("MICROSOFT_CLIENT_ID"),
      clientSecret: readEnv("MICROSOFT_CLIENT_SECRET"),
      tenantId: readEnv("MICROSOFT_TENANT_ID", "common"),
      redirectUri: readEnv(
        "MICROSOFT_REDIRECT_URI",
        "http://localhost:3000/auth/microsoft/callback"
      )
    }
  };
}
