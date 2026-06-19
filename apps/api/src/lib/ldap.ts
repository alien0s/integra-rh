import * as ldap from "ldapjs";

import { type ApiConfig, getApiConfig } from "../plugins/env.js";

export class LdapUnavailableError extends Error {
  constructor(message = "LDAP indisponível") {
    super(message);
    this.name = "LdapUnavailableError";
  }
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

/**
 * Autentica credenciais contra LDAP.
 * Enquanto LDAP_ENABLED=false em desenvolvimento, permite login sem conectar no LDAP.
 */
export async function authenticateWithLdap(
  email: string,
  password: string
): Promise<boolean> {
  const config = getApiConfig();

  if (!config.ldap.enabled) {
    if (config.nodeEnv === "production") {
      throw new LdapUnavailableError("LDAP desabilitado");
    }

    console.warn("AVISO: LDAP desabilitado. Simulando autenticação em desenvolvimento.");
    return true;
  }

  if (!hasLdapConfig(config.ldap)) {
    throw new LdapUnavailableError("Configuração do LDAP incompleta");
  }

  const ldapConfig = config.ldap;

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: ldapConfig.url
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
        attributes: ["dn"]
      };

      client.search(ldapConfig.searchBase, searchOptions, (searchErr, res) => {
        if (searchErr) {
          client.unbind((_) => {});
          return reject(
            new LdapUnavailableError(`Erro de busca no LDAP: ${searchErr.message}`)
          );
        }

        let userDn: string | null = null;

        res.on("searchEntry", (entry) => {
          userDn = entry.dn.toString();
        });

        res.on("error", (err) => {
          client.unbind((_) => {});
          reject(new LdapUnavailableError(`Erro ao buscar usuário: ${err.message}`));
        });

        res.on("end", () => {
          if (!userDn) {
            client.unbind((_) => {});
            return resolve(false);
          }

          const userClient = ldap.createClient({ url: ldapConfig.url });

          userClient.on("error", () => {
            userClient.unbind((_) => {});
          });

          userClient.bind(userDn, password, (userBindErr) => {
            userClient.unbind((_) => {});
            client.unbind((_) => {});

            if (userBindErr) {
              return resolve(false);
            }

            return resolve(true);
          });
        });
      });
    });
  });
}
