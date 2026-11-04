import { BookOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getToken } from '@/lib/auth'

/**
 * Abre a documentação em nova aba, autenticada. A rota exige ADMIN no
 * backend; abrir direto no navegador não carrega o token do localStorage
 * (não há JS do app rodando naquela página pra anexar o header
 * Authorization), então ele vai por querystring — mesmo mecanismo já usado
 * no stream SSE de notificações, que tem a mesma limitação.
 */
function abrirDocumentacao() {
  const token = getToken()
  if (!token) return
  window.open(`/api/reference/?token=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer')
}

/**
 * Seção de Configurações com o link para a documentação interativa da API
 * (Swagger/Scalar) — ver docs/api.md. Só aparece no nav para ADMIN.
 */
export function DocumentacaoApiSection() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium">Documentação da API</h3>
        <p className="text-sm text-muted-foreground">
          Referência interativa de todas as rotas da API (OpenAPI/Swagger) —
          acesso restrito a ADMIN.
        </p>
      </div>
      <Separator />

      <Button type="button" onClick={abrirDocumentacao} className="w-fit">
        <BookOpen className="h-4 w-4" />
        Abrir documentação
      </Button>
    </div>
  )
}
