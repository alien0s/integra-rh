import nodemailer, { type Transporter } from "nodemailer";

import { getApiConfig } from "../plugins/env.js";

/**
 * Envio de e-mail (SMTP corporativo) — ver bloco `smtp` em plugins/env.ts.
 * Primeira (e por enquanto única) integração de e-mail de saída do sistema
 * — pensada pra ser genérica o bastante pra qualquer feature futura reusar,
 * não só férias.
 *
 * Mesmo portão `enabled` do mssql/ldap: sem config, `enviarEmail` só loga e
 * retorna, sem tentar conectar. E nunca lança — e-mail é sempre um efeito
 * colateral "best effort" de alguma ação que já foi concluída antes dele
 * (ex.: confirmação de férias já salva no banco); uma falha de SMTP não pode
 * derrubar nem desfazer a ação principal.
 */

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const { smtp } = getApiConfig();
  _transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // true só seria pro modo implícito (porta 465) — 587 usa STARTTLS, que o
    // nodemailer negocia sozinho quando secure=false e o servidor anuncia.
    secure: false,
    auth: { user: smtp.user, pass: smtp.password },
  });
  return _transporter;
}

export interface EnviarEmailOpts {
  para: string;
  assunto: string;
  texto: string;
  /**
   * Bloco HTML extra, inserido entre o cabeçalho e o texto — pro selo de
   * destaque de um tipo específico de e-mail (ex.: ícone + título "Férias
   * confirmadas"). Opcional: sem isso, o e-mail sai só com o cabeçalho
   * padrão (ver `montarHtmlEmail` abaixo) + o texto.
   */
  destaqueHtml?: string;
}

/** Mesmas cores de marca usadas no app (ver AppLogo.tsx: bg-blue-600). */
const COR_MARCA = "#2563eb";
const COR_TEXTO = "#1e293b";
const COR_BORDA = "#e2e8f0";

/**
 * Ícone do cabeçalho (folha, mesmo path do ícone "Leaf" do lucide-react usado
 * em AppLogo.tsx) — SVG inline, não imagem: um anexo `cid` ou data URI não
 * renderiza no Outlook clássico (motor Word), mas um `<svg>` inline funciona
 * na maioria dos clientes modernos (Gmail, Apple Mail, Outlook novo/web,
 * apps mobile) — na pior hipótese (Outlook clássico), some só o desenho, o
 * quadrado azul e o texto "IntegraRH" continuam aparecendo normalmente.
 */
const SVG_LOGO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;

/** Cabeçalho padrão (logo + "IntegraRH") — igual em TODO e-mail do sistema. */
const CABECALHO_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding:20px 24px;border-bottom:1px solid ${COR_BORDA};">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td width="32" height="32" align="center" valign="middle" style="background-color:${COR_MARCA};border-radius:8px;">
            ${SVG_LOGO}
          </td>
          <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#0f172a;" valign="middle">
            IntegraRH
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

/** Escapa `&`/`<`/`>` antes de embutir texto dinâmico no HTML do e-mail. */
function escaparHtml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Converte o `texto` plano (mesmo usado no fallback text/plain) em parágrafos
 * HTML — um por quebra dupla de linha ("\n\n", como já é escrito hoje) — e
 * transforma URLs soltas em links clicáveis. Genérico: todo `enviarEmail`
 * passa por aqui, não só o de férias.
 */
function textoParaParagrafosHtml(texto: string): string {
  return texto
    .split(/\n\n+/)
    .map((paragrafo) => {
      const comLinks = escaparHtml(paragrafo)
        .replace(/\n/g, "<br>")
        .replace(
          /(https?:\/\/[^\s<]+)/g,
          (url) => `<a href="${url}" style="color:${COR_MARCA};">${url}</a>`,
        );
      return `<p style="margin:0 0 12px;">${comLinks}</p>`;
    })
    .join("");
}

/**
 * Monta o HTML completo do e-mail: cabeçalho padrão + (opcional) selo de
 * destaque do chamador + o texto. Layout em tabelas/estilo inline de
 * propósito — é o que funciona de forma previsível em clientes de e-mail
 * corporativos (Outlook/Exchange, ver docs/email.md), que ignoram `<style>`
 * e boa parte do CSS moderno.
 */
function montarHtmlEmail(opts: { texto: string; destaqueHtml?: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;">
            <tr><td>${CABECALHO_HTML}</td></tr>
            <tr>
              <td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${COR_TEXTO};">
                ${opts.destaqueHtml ?? ""}
                ${textoParaParagrafosHtml(opts.texto)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function enviarEmail(opts: EnviarEmailOpts): Promise<void> {
  const { smtp } = getApiConfig();
  if (!smtp.enabled) {
    console.log(`[email] SMTP desabilitado — envio pulado (assunto: "${opts.assunto}").`);
    return;
  }

  try {
    await getTransporter().sendMail({
      from: smtp.from,
      to: opts.para,
      subject: opts.assunto,
      text: opts.texto,
      html: montarHtmlEmail({ texto: opts.texto, destaqueHtml: opts.destaqueHtml }),
    });
  } catch (error) {
    console.error(`[email] falha ao enviar pra ${opts.para}:`, error);
  }
}
