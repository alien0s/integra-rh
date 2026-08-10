import ldap from "ldapjs";

import { getApiConfig } from "../plugins/env.js";

/**
 * Testa a conexão com o LDAP/AD usando as variáveis do .env, fora do fluxo
 * de login (funciona mesmo com LDAP_ENABLED=false).
 *
 * Uso:
 *   pnpm --filter @erp/api test:ldap
 *     → teste genérico de conectividade/bind da conta de serviço.
 *   pnpm --filter @erp/api test:ldap -- usuario@adventistas.org
 *     → busca esse e-mail específico no AD e mostra se foi encontrado, em
 *       qual DN e alguns atributos úteis para diagnóstico. Depois pergunta a
 *       senha de forma escondida (sem eco, sem passar pelo shell) para
 *       também testar o bind.
 */

const TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, etapa: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de ${TIMEOUT_MS}ms em: ${etapa}`)), TIMEOUT_MS),
    ),
  ]);
}

/** Decodifica os bits mais comuns de userAccountControl (AD). */
function descreverUserAccountControl(valor: string): string | null {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return null;

  const notas: string[] = [];
  if (numero & 0x2) notas.push("CONTA DESABILITADA no AD");
  if (numero & 0x10) notas.push("conta bloqueada (lockout)");
  if (numero & 0x800000) notas.push("senha expirada");
  return notas.length > 0 ? notas.join(", ") : "conta ativa, sem flags relevantes";
}

// Códigos de byte usados no prompt de senha escondida (comparar por código
// em vez de literal de string evita problemas de encoding com caracteres de
// controle como Enter/Backspace/Ctrl-C).
const BYTE_ENTER_LF = 10;
const BYTE_ENTER_CR = 13;
const BYTE_CTRL_C = 3;
const BYTE_CTRL_D = 4;
const BYTE_BACKSPACE = 8;
const BYTE_DELETE = 127;

/** Lê a senha do terminal sem exibir os caracteres digitados (evita o shell). */
function perguntarSenhaEscondida(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(pergunta);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);

    let senha = "";
    const onData = (chunk: Buffer) => {
      const byte = chunk[0];

      if (byte === BYTE_ENTER_LF || byte === BYTE_ENTER_CR || byte === BYTE_CTRL_D) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(senha);
        return;
      }

      if (byte === BYTE_CTRL_C) {
        process.stdout.write("\n");
        process.exit(1);
      }

      if (byte === BYTE_BACKSPACE || byte === BYTE_DELETE) {
        if (senha.length > 0) {
          senha = senha.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      senha += chunk.toString("utf8");
      process.stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [emailAlvo, senhaAlvo] = process.argv.slice(2);
  const config = getApiConfig().ldap;

  console.log("Configuração lida do .env:");
  console.log(`  LDAP_ENABLED          = ${config.enabled}`);
  console.log(`  LDAP_URL              = ${config.url}`);
  console.log(`  LDAP_BIND_DN          = ${config.bindDn}`);
  console.log(`  LDAP_BIND_CREDENTIALS = ${config.bindCredentials ? "*".repeat(8) : "(vazio)"}`);
  console.log(`  LDAP_SEARCH_BASE      = ${config.searchBase}`);
  console.log(`  LDAP_SEARCH_FILTER    = ${config.searchFilter}`);
  console.log(`  LDAP_TLS_REJECT_UNAUTHORIZED = ${config.tlsRejectUnauthorized}`);
  console.log("");

  if (!config.tlsRejectUnauthorized) {
    console.warn(
      "⚠ Verificação do certificado TLS DESLIGADA (LDAP_TLS_REJECT_UNAUTHORIZED=false). " +
        "Use só até configurar o certificado da CA interna — nunca em produção.\n",
    );
  }

  if (!config.url || !config.bindDn || !config.bindCredentials || !config.searchBase) {
    console.error(
      "✗ Configuração incompleta — verifique LDAP_URL, LDAP_BIND_DN, LDAP_BIND_CREDENTIALS e LDAP_SEARCH_BASE no .env.",
    );
    process.exit(1);
  }

  if (config.url.startsWith("ldap://") && config.url.endsWith(":636")) {
    console.warn(
      "⚠ A URL usa o esquema ldap:// (sem TLS) na porta 636, que normalmente é a porta do LDAPS. " +
        "Isso costuma causar timeout/erro de protocolo. Considere ldaps://<host>:636 ou ldap://<host>:389.\n",
    );
  }

  const client = ldap.createClient({
    url: config.url,
    connectTimeout: TIMEOUT_MS,
    timeout: TIMEOUT_MS,
    tlsOptions: { rejectUnauthorized: config.tlsRejectUnauthorized },
  });

  let erroCliente: Error | null = null;
  client.on("error", (err) => {
    erroCliente = err;
    console.error(`✗ Erro no cliente LDAP: ${err.message}`);
  });

  try {
    console.log(`→ Conectando e autenticando (bind) em ${config.url} ...`);
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        client.bind(config.bindDn, config.bindCredentials, (err) => {
          if (err) return reject(err);
          resolve();
        });
      }),
      "bind da conta de serviço",
    );
    console.log("✓ Bind da conta de serviço OK.\n");

    if (emailAlvo) {
      await testarUsuarioEspecifico(client, config, emailAlvo, senhaAlvo);
    } else {
      await testarConectividadeGenerica(client, config);
    }
  } catch (error) {
    console.error(`\n✗ Falha: ${error instanceof Error ? error.message : String(error)}`);
    if (erroCliente) {
      console.error(`  (erro adicional do cliente: ${(erroCliente as Error).message})`);
    }
    process.exitCode = 1;
  } finally {
    client.unbind(() => {
      client.destroy();
    });
  }
}

async function testarConectividadeGenerica(
  client: ldap.Client,
  config: ReturnType<typeof getApiConfig>["ldap"],
) {
  console.log(`→ Testando busca em: ${config.searchBase}`);
  const filtroTeste = config.searchFilter.includes("{{email}}")
    ? config.searchFilter.replace("{{email}}", "*")
    : config.searchFilter;

  const totalEncontrado = await withTimeout(
    new Promise<number>((resolve, reject) => {
      client.search(
        config.searchBase,
        { filter: filtroTeste, scope: "sub", attributes: ["dn"], sizeLimit: 5 },
        (searchErr, res) => {
          if (searchErr) return reject(searchErr);

          let total = 0;
          let limitou = false;
          res.on("searchEntry", (entry) => {
            total += 1;
            console.log(`  • ${entry.dn.toString()}`);
          });
          res.on("error", (err) => {
            // Não é falha: só significa que há mais resultados do que o
            // sizeLimit pedido acima (esperado com um filtro amplo de teste).
            if (err.name === "SizeLimitExceededError") {
              limitou = true;
              return resolve(total);
            }
            reject(err);
          });
          res.on("end", () => {
            if (!limitou) resolve(total);
          });
        },
      );
    }),
    "busca de teste",
  );

  console.log(`✓ Busca OK — ${totalEncontrado} registro(s) encontrado(s) (limite 5).\n`);
  console.log("Conexão LDAP funcionando corretamente.");
}

async function testarUsuarioEspecifico(
  client: ldap.Client,
  config: ReturnType<typeof getApiConfig>["ldap"],
  email: string,
  senhaArg: string | undefined,
) {
  let senha = senhaArg;
  const filtro = config.searchFilter.replace("{{email}}", email);
  console.log(`→ Buscando "${email}" em: ${config.searchBase}`);
  console.log(`  (filtro: ${filtro})\n`);

  const atributos = [
    "dn",
    "mail",
    "userPrincipalName",
    "sAMAccountName",
    "userAccountControl",
    "thumbnailPhoto",
    "jpegPhoto",
  ];
  const atributosBinarios = new Set(["thumbnailPhoto", "jpegPhoto"]);

  interface Entrada {
    valores: Record<string, string>;
    fotoBytes: number;
  }

  const entradas = await withTimeout(
    new Promise<Entrada[]>((resolve, reject) => {
      client.search(
        config.searchBase,
        { filter: filtro, scope: "sub", attributes: atributos, sizeLimit: 5 },
        (searchErr, res) => {
          if (searchErr) return reject(searchErr);

          const resultados: Entrada[] = [];
          res.on("searchEntry", (entry) => {
            const valores: Record<string, string> = { dn: entry.dn.toString() };
            let fotoBytes = 0;
            for (const attr of entry.attributes) {
              if (atributosBinarios.has(attr.type)) {
                // Não decodifica como texto: valores.join() corromperia os
                // bytes binários da foto. Só reporta o tamanho.
                fotoBytes = Math.max(fotoBytes, attr.buffers[0]?.length ?? 0);
                continue;
              }
              valores[attr.type] = ([] as string[]).concat(attr.values).join(", ");
            }
            resultados.push({ valores, fotoBytes });
          });
          res.on("error", (err) => reject(err));
          res.on("end", () => resolve(resultados));
        },
      );
    }),
    "busca do usuário",
  );

  if (entradas.length === 0) {
    console.log(
      `✗ Nenhum usuário encontrado com esse e-mail dentro de LDAP_SEARCH_BASE.\n` +
        `  Possíveis causas: o e-mail não está preenchido no atributo "mail" do AD para\n` +
        `  esse usuário, o usuário fica em outra OU (fora de "${config.searchBase}"),\n` +
        `  ou o atributo certo é outro (ex.: userPrincipalName em vez de mail).`,
    );
    process.exitCode = 1;
    return;
  }

  if (entradas.length > 1) {
    console.log(`⚠ Encontrei ${entradas.length} usuários com esse filtro (esperado: 1).\n`);
  }

  for (const { valores, fotoBytes } of entradas) {
    console.log(`✓ Encontrado: ${valores.dn}`);
    console.log(`  mail               = ${valores.mail ?? "(vazio)"}`);
    console.log(`  userPrincipalName  = ${valores.userPrincipalName ?? "(vazio)"}`);
    console.log(`  sAMAccountName     = ${valores.sAMAccountName ?? "(vazio)"}`);
    if (valores.userAccountControl) {
      console.log(
        `  userAccountControl = ${valores.userAccountControl} (${descreverUserAccountControl(valores.userAccountControl)})`,
      );
    }
    console.log(
      `  foto (thumbnailPhoto/jpegPhoto) = ${fotoBytes > 0 ? `${fotoBytes} bytes encontrados` : "(sem foto no AD)"}`,
    );
    console.log("");
  }

  if (!senha && process.stdin.isTTY) {
    // Prompt escondido (sem eco na tela) em vez de exigir a senha como
    // argumento — evita que o bash interprete caracteres especiais da senha
    // (ex.: $, `, !) antes de chegar no script, e evita deixar a senha no
    // histórico do terminal.
    senha = await perguntarSenhaEscondida("Digite a senha do AD para testar o bind: ");
  }

  if (!senha) {
    console.log(
      "Usuário encontrado. Para testar a senha também, rode de novo (o script vai\n" +
        "perguntar a senha de forma escondida, sem passar pelo shell):\n" +
        `  pnpm --filter @erp/api test:ldap -- ${email}`,
    );
    return;
  }

  const dnAlvo = entradas[0].valores.dn;
  // Usa userPrincipalName (ASCII) em vez do DN sempre que disponível: quando
  // o DN tem acentos (ç, ã, etc.), entry.dn.toString() devolve esses bytes
  // escapados em hexadecimal (RFC 4514) e o ldapjs manda esse texto escapado
  // literalmente no bind, em vez de decodificar de volta — o AD não reconhece
  // esse DN "escapado" como o DN de verdade e recusa com "Invalid
  // Credentials", mesmo com a senha certa.
  const identidadeBind = entradas[0].valores.userPrincipalName || dnAlvo;
  console.log(`→ Testando bind com a senha informada (identidade: ${identidadeBind}) ...`);
  if (identidadeBind !== dnAlvo) {
    console.log(`  (usando userPrincipalName em vez do DN, para evitar problema de acentuação)`);
  }

  const userClient = ldap.createClient({
    url: config.url,
    connectTimeout: TIMEOUT_MS,
    timeout: TIMEOUT_MS,
    tlsOptions: { rejectUnauthorized: config.tlsRejectUnauthorized },
  });
  userClient.on("error", () => {});

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        userClient.bind(identidadeBind, senha, (err) => {
          if (err) return reject(err);
          resolve();
        });
      }),
      "bind com a senha do usuário",
    );
    console.log("✓ Senha confere — o AD aceitou o bind com essa senha.");
  } catch (error) {
    console.error(
      `✗ O AD recusou o bind com essa senha: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    userClient.unbind(() => userClient.destroy());
  }
}

main();
