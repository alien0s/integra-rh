import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DetalheQualificacaoConteudo } from './DetalheQualificacaoConteudo'
import {
  fecharDetalheQualificacao,
  registrarDecisaoQualificacao,
  useDetalheQualificacaoEstado,
} from '../lib/detalheQualificacaoStore'

/**
 * Dialog universal de detalhe de uma qualificação (formação acadêmica, curso/
 * workshop/certificação ou idioma) — aberto ao clicar numa notificação de
 * "novo cadastro" (ver NotificacoesDrawer, via abrirDetalheQualificacao). O
 * conteúdo em si (campos, aprovar/recusar/ver anexo) vive em
 * `DetalheQualificacaoConteudo`, reaproveitado também por
 * `QualificacoesPendentesDialog` (embutido no mesmo dialog da fila, sem abrir
 * um segundo dialog por cima).
 *
 * Sem props: lê e fecha pelo store global (ver lib/detalheQualificacaoStore)
 * e montado uma única vez na raiz do app (ver App.tsx) — de propósito, pra
 * sobreviver à navegação pra /cursos que acontece ao clicar na notificação
 * (cada página tem seu próprio AppLayout, sem layout compartilhado entre
 * rotas — um dialog "local" de quem abriu seria desmontado na mesma hora).
 */
export function DetalheQualificacaoDialog() {
  const { aberto: open, referenciaTabela, referenciaId, nomeFuncionario } =
    useDetalheQualificacaoEstado()

  return (
    <Dialog
      open={open}
      onOpenChange={(novoEstado) => {
        if (!novoEstado) fecharDetalheQualificacao()
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        {referenciaTabela && referenciaId && (
          <DetalheQualificacaoConteudo
            referenciaTabela={referenciaTabela}
            referenciaId={referenciaId}
            nomeFuncionario={nomeFuncionario}
            onFechar={(decidiu) => {
              if (decidiu) registrarDecisaoQualificacao()
              fecharDetalheQualificacao()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
