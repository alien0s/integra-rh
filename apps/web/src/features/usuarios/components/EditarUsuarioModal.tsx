import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type {
  AtualizarUsuarioInput,
  OpcaoSelecao,
  Usuario,
} from '@/features/usuarios/types'
import type { Papel } from '@/features/tabelas/types'
import { mascararTelefone } from '@/lib/masks'

/** Catálogo fixo (5 valores, ver migration 005_estados_civis.sql) — sem rota
 *  GET dedicada, mesmo padrão de enum hardcoded já usado pra tipoFuncionario
 *  (CriarUsuarioDialog.tsx). Valores idênticos a `estados_civis.nome`. */
const ESTADO_CIVIL_LABEL: Record<string, string> = {
  SOLTEIRO: 'Solteiro(a)',
  CASADO: 'Casado(a)',
  SEPARADO: 'Separado(a)',
  DIVORCIADO: 'Divorciado(a)',
  VIUVO: 'Viúvo(a)',
}
const ESTADOS_CIVIS = Object.keys(ESTADO_CIVIL_LABEL)

interface EditarUsuarioModalProps {
  /** Usuário em edição (null quando o modal está fechado). */
  usuario: Usuario | null
  /** Opções dos dropdowns. */
  entidades: OpcaoSelecao[]
  setores: OpcaoSelecao[]
  funcoes: OpcaoSelecao[]
  papeis: Papel[]
  /** Indica que o salvamento está em andamento. */
  isSaving?: boolean
  /**
   * Restringe a edição a telefone e estado civil — usado quando o
   * COLABORADOR edita o próprio perfil (em "Meu perfil"): entidade/setor/
   * função/papel exigem o RH/DP, então nem aparecem aqui (também não seria
   * aceito pela API nesse caso — ver PATCH /usuarios/:id). Telefone/estado
   * civil mudados aqui notificam DP/COORDENADOR DP pra replicar no APS (ver
   * notificarDpParaAtualizarAps no backend).
   */
  apenasContato?: boolean
  onClose: () => void
  onSalvar: (input: AtualizarUsuarioInput) => void
}

/** Estado do formulário de edição. */
interface FormState {
  entidadeId: string
  telefone: string
  setorId: string
  funcaoId: string
  papelCodigo: string
  estadoCivilCodigo: string
}

/** Acha o id de uma opção pelo nome (para pré-selecionar os dropdowns). */
function idPorNome(opcoes: OpcaoSelecao[], nome: string): string {
  return opcoes.find((opcao) => opcao.nome === nome)?.id ?? ''
}

/** Acha o código do estado civil a partir do nome já traduzido vindo da API
 *  (ex.: "Solteiro(a)" → "SOLTEIRO") — não há catálogo id/nome pra isso, só
 *  o label map fixo acima. */
function codigoEstadoCivilPorNome(nome: string | null | undefined): string {
  return Object.entries(ESTADO_CIVIL_LABEL).find(([, label]) => label === nome)?.[0] ?? ''
}

/**
 * Modal de edição das informações do usuário (entidade, telefone, setor e
 * função). O botão Salvar só habilita quando há alteração no formulário.
 *
 * CPF não é editável aqui de propósito: vem só do sistema legado da empresa
 * (buscarFuncionarioLegado, apps/api/src/lib/mssql.ts) — se estiver errado,
 * o conserto é lá, não neste app (ver lib/usuarios.ts:
 * inserirUsuarioComLegado/preencherDadosLegadoSeVazio, os únicos lugares que
 * ainda escrevem cpf).
 *
 * Este componente não decide QUEM pode abri-lo — ele só renderiza quando o
 * pai passa um `usuario` (ver a prop). Quem abre o gatilho ("Editar") é
 * `UsuarioPerfilHeader.tsx`/`UsuarioPerfilConteudo.tsx` (perfil de alguém) e
 * `UsuariosTable.tsx` (lista) — ambos condicionam a exibição do botão a
 * `podeEditarUsuario` (features/usuarios/lib/permissoes.ts): por enquanto só
 * ADMIN, e nunca sobre o próprio usuário logado (exceto o fluxo separado
 * `apenasContato`, que é o COLABORADOR editando o próprio telefone e estado
 * civil em "Meu perfil" — não é afetado por essa regra).
 */
export function EditarUsuarioModal({
  usuario,
  entidades,
  setores,
  funcoes,
  papeis,
  isSaving = false,
  apenasContato = false,
  onClose,
  onSalvar,
}: EditarUsuarioModalProps) {
  const [form, setForm] = useState<FormState>({
    entidadeId: '',
    telefone: '',
    setorId: '',
    funcaoId: '',
    papelCodigo: '',
    estadoCivilCodigo: '',
  })

  // Valores iniciais (para detectar alterações e habilitar o Salvar).
  const initial = useMemo<FormState>(
    () => ({
      entidadeId: usuario ? idPorNome(entidades, usuario.entidade ?? '') : '',
      telefone: usuario?.telefone ?? '',
      setorId: usuario ? idPorNome(setores, usuario.setor) : '',
      funcaoId: usuario ? idPorNome(funcoes, usuario.funcao) : '',
      papelCodigo: usuario?.papelCodigo ?? '',
      estadoCivilCodigo: codigoEstadoCivilPorNome(usuario?.estadoCivil),
    }),
    [usuario, entidades, setores, funcoes],
  )

  // Sincroniza o form quando abre com um novo usuário/opções.
  useEffect(() => {
    setForm(initial)
  }, [initial])

  const alterado =
    form.entidadeId !== initial.entidadeId ||
    form.telefone !== initial.telefone ||
    form.setorId !== initial.setorId ||
    form.funcaoId !== initial.funcaoId ||
    form.papelCodigo !== initial.papelCodigo ||
    form.estadoCivilCodigo !== initial.estadoCivilCodigo

  function handleSalvar() {
    onSalvar({
      entidadeId: form.entidadeId || null,
      telefone: form.telefone.trim() || null,
      setorId: form.setorId || null,
      funcaoId: form.funcaoId || null,
      roleCodigo: form.papelCodigo || null,
      // Só o autoatendimento manda esse campo — no modo completo do ADMIN a
      // chave nem existe no payload (backend não aceita de qualquer forma).
      ...(apenasContato ? { estadoCivilCodigo: form.estadoCivilCodigo || null } : {}),
    })
  }

  return (
    <Dialog
      open={Boolean(usuario)}
      onOpenChange={(aberto) => !aberto && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{apenasContato ? 'Editar meus dados' : 'Editar usuário'}</DialogTitle>
          <DialogDescription>
            {apenasContato
              ? 'Atualize seu telefone e estado civil. Os demais dados dependem do RH/DP.'
              : `Atualize os dados de ${usuario?.nome}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Entidade</Label>
              <Select
                value={form.entidadeId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, entidadeId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entidades.map((entidade) => (
                    <SelectItem key={entidade.id} value={entidade.id}>
                      {entidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={form.telefone}
              inputMode="tel"
              maxLength={19}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  telefone: mascararTelefone(event.target.value),
                }))
              }
              placeholder="+55 (00) 00000-0000"
            />
          </div>

          {apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Estado civil</Label>
              <Select
                value={form.estadoCivilCodigo}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, estadoCivilCodigo: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado civil" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVIS.map((codigo) => (
                    <SelectItem key={codigo} value={codigo}>
                      {ESTADO_CIVIL_LABEL[codigo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Setor</Label>
              <Select
                value={form.setorId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, setorId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.id}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Função</Label>
              <Select
                value={form.funcaoId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, funcaoId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {funcoes.map((funcao) => (
                    <SelectItem key={funcao.id} value={funcao.id}>
                      {funcao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Papel</Label>
              <Select
                value={form.papelCodigo}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, papelCodigo: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {papeis.map((papel) => (
                    <SelectItem key={papel.codigo} value={papel.codigo}>
                      {papel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={!alterado || isSaving}
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
