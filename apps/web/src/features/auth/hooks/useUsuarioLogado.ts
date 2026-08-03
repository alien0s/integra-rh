import { useEffect, useState } from 'react'

import { usuariosService } from '@/features/usuarios/services'
import type { Usuario } from '@/features/usuarios/types'
import { useAuthUser, type AuthUsuario } from '@/features/auth/hooks/useAuthUser'

interface UsuarioLogado {
  /** Identidade imediata (do JWT), disponível antes do fetch. */
  authUser: AuthUsuario | null
  /** Perfil completo vindo da API (com fotoUrl resolvida) ou null. */
  usuario: Usuario | null
  isLoading: boolean
  error: string | null
  recarregar: () => void
}

/**
 * Cache em memória (nível de módulo) do perfil do usuário logado.
 *
 * A sidebar (e o NavUser) remonta a cada navegação, pois cada página renderiza
 * seu próprio AppLayout. Sem cache, o hook zeraria o perfil a cada mount e a
 * foto piscaria (caía nas iniciais e recarregava). Com o cache, o remount já
 * devolve os dados na hora e só revalida em segundo plano.
 */
let cache: { id: string; usuario: Usuario } | null = null

/** Limpa o cache do perfil (ex.: ao sair). */
export function limparCacheUsuarioLogado() {
  cache = null
}

/**
 * Perfil completo do usuário logado: pega o id no JWT (useAuthUser) e busca
 * GET /usuarios/:id (que traz cpf, telefone, fotoUrl resolvida, etc.).
 */
export function useUsuarioLogado(): UsuarioLogado {
  const authUser = useAuthUser()
  const id = authUser?.id ?? null

  const emCache = cache && cache.id === id ? cache.usuario : null
  const [usuario, setUsuario] = useState<Usuario | null>(emCache)
  // Só mostra "carregando" no primeiro fetch (sem cache); revalidação é silenciosa.
  const [isLoading, setIsLoading] = useState(Boolean(id) && !emCache)
  const [error, setError] = useState<string | null>(null)
  // Contador para forçar o refetch em recarregar().
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    if (!id) {
      setUsuario(null)
      setIsLoading(false)
      return
    }

    // Se já há cache para este id, mostra na hora e revalida sem "loading".
    const cacheAtual = cache && cache.id === id ? cache.usuario : null
    if (cacheAtual) {
      setUsuario(cacheAtual)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
    setError(null)

    void (async () => {
      try {
        const data = await usuariosService.getUsuario(id)
        cache = { id, usuario: data }
        if (ativo) setUsuario(data)
      } catch {
        if (ativo) setError('Não foi possível carregar seu perfil.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    })()

    return () => {
      ativo = false
    }
  }, [id, versao])

  function recarregar() {
    // Invalida o cache deste usuário e refaz o fetch.
    if (cache && cache.id === id) cache = null
    setVersao((v) => v + 1)
  }

  return { authUser, usuario, isLoading, error, recarregar }
}
