/**
 * Máscaras de input reutilizáveis (CPF, telefone).
 * Aplicadas no onChange dos campos, formatando enquanto o usuário digita.
 */

/**
 * Máscara de CPF: 000.000.000-00.
 * Mantém só dígitos (máx. 11) e insere os dois pontos e o hífen.
 */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Máscara de telefone: +55 (11) 98765-4321.
 * Mantém só dígitos (máx. 13 = país + DDD + número) e insere +, ( ), espaço e -.
 */
export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 13)
  if (d.length === 0) return ''

  const pais = d.slice(0, 2)
  const ddd = d.slice(2, 4)
  const numero = d.slice(4) // até 9 dígitos

  let out = `+${pais}`
  if (d.length >= 3) out += ` (${ddd}`
  if (d.length >= 5) out += ') '
  if (numero) {
    out +=
      numero.length > 5 ? `${numero.slice(0, 5)}-${numero.slice(5)}` : numero
  }
  return out
}
