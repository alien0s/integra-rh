import ldap from "ldapjs";

import { type ApiConfig, getApiConfig } from "../plugins/env.js";

export class LdapUnavailableError extends Error {
  constructor(message = "LDAP indisponível") {
    super(message);
    this.name = "LdapUnavailableError";
  }
}

/** Resultado da autenticação: se autenticou e, quando disponível, a foto do AD. */
export interface LdapAuthResult {
  ok: boolean;
  /** Foto do AD (thumbnailPhoto/jpegPhoto) já como data URI, ou null se não houver. */
  avatarDataUri: string | null;
}

function hasLdapConfig(config: ApiConfig["ldap"]) {
  return Boolean(
    config.url &&
      config.bindDn &&
      config.bindCredentials &&
      config.searchBase &&
      config.searchFilter
  );
}

/** Monta a foto (thumbnailPhoto/jpegPhoto) como data URI, se o atributo existir. */
function extrairAvatarDataUri(entry: ldap.SearchEntry): string | null {
  const attr = entry.attributes.find(
    (a) => a.type === "thumbnailPhoto" || a.type === "jpegPhoto"
  );
  const buffer = attr?.buffers[0];

  if (!buffer || buffer.length === 0) {
    return null;
  }

  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

/**
 * Autentica credenciais contra LDAP.
 * Enquanto LDAP_ENABLED=false em desenvolvimento, permite login sem conectar no LDAP.
 */
export async function authenticateWithLdap(
  email: string,
  password: string
): Promise<LdapAuthResult> {
  const config = getApiConfig();

  if (!config.ldap.enabled) {
    if (config.nodeEnv === "production") {
      throw new LdapUnavailableError("LDAP desabilitado");
    }

    console.warn("AVISO: LDAP desabilitado. Simulando autenticação em desenvolvimento.");
    return { ok: true, avatarDataUri: null };
  }

  if (!hasLdapConfig(config.ldap)) {
    throw new LdapUnavailableError("Configuração do LDAP incompleta");
  }

  const ldapConfig = config.ldap;

  if (!ldapConfig.tlsRejectUnauthorized) {
    console.warn(
      "AVISO: LDAP_TLS_REJECT_UNAUTHORIZED=false — verificação do certificado " +
        "TLS do LDAPS desligada. Use só temporariamente (nunca em produção).",
    );
  }

  const tlsOptions = { rejectUnauthorized: ldapConfig.tlsRejectUnauthorized };

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: ldapConfig.url,
      tlsOptions
    });

    client.on("error", (err) => {
      client.unbind((_) => {});
      reject(new LdapUnavailableError(`Erro no cliente LDAP: ${err.message}`));
    });

    client.bind(ldapConfig.bindDn, ldapConfig.bindCredentials, (bindErr) => {
      if (bindErr) {
        client.unbind((_) => {});
        return reject(
          new LdapUnavailableError(`Erro de bind no LDAP: ${bindErr.message}`)
        );
      }

      const filter = ldapConfig.searchFilter.replace("{{email}}", email);

      const searchOptions: ldap.SearchOptions = {
        filter,
        scope: "sub",
        attributes: ["dn", "userPrincipalName", "thumbnailPhoto", "jpegPhoto"]
      };

      client.search(ldapConfig.searchBase, searchOptions, (searchErr, res) => {
        if (searchErr) {
          client.unbind((_) => {});
          return reject(
            new LdapUnavailableError(`Erro de busca no LDAP: ${searchErr.message}`)
          );
        }

        let userDn: string | null = null;
        let userPrincipalName: string | null = null;
        let avatarDataUri: string | null = null;

        res.on("searchEntry", (entry) => {
          userDn = entry.dn.toString();
          userPrincipalName =
            entry.attributes.find((attr) => attr.type === "userPrincipalName")?.values[0] ?? null;
          avatarDataUri = extrairAvatarDataUri(entry);
        });

        res.on("error", (err) => {
          client.unbind((_) => {});
          reject(new LdapUnavailableError(`Erro ao buscar usuário: ${err.message}`));
        });

        res.on("end", () => {
          if (!userDn) {
            client.unbind((_) => {});
            return resolve({ ok: false, avatarDataUri: null });
          }

          // Usa o userPrincipalName (ASCII, ex.: nome@dominio) em vez do DN
          // sempre que possível: o DN vem com caracteres não-ASCII (ex.: "ç",
          // "ã" em nomes/departamentos) escapados em hexadecimal por
          // entry.dn.toString() (RFC 4514), mas o ldapjs manda esse texto
          // escapado literalmente no bind em vez de decodificar de volta para
          // os bytes reais — o AD não reconhece esse DN "escapado" como o DN
          // de verdade e recusa com "Invalid Credentials", mesmo com a senha
          // certa. userPrincipalName evita esse problema por ser só ASCII.
          const identidadeBind = userPrincipalName ?? userDn;

          const userClient = ldap.createClient({ url: ldapConfig.url, tlsOptions });

          userClient.on("error", () => {
            userClient.unbind((_) => {});
          });

          userClient.bind(identidadeBind, password, (userBindErr) => {
            userClient.unbind((_) => {});
            client.unbind((_) => {});

            if (userBindErr) {
              return resolve({ ok: false, avatarDataUri: null });
            }

            return resolve({ ok: true, avatarDataUri });
          });
        });
      });
    });
  });
}
