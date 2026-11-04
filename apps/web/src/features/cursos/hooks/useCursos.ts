import { useCallback, useEffect, useState } from 'react'

import { cursosService } from '../services'
import type {
  CursoQualificacao,
  EditarFormacaoInput,
  FormacaoAcademica,
  FuncionarioQualificacoes,
  Idioma,
  NovaFormacaoInput,
  NovoCursoInput,
  NovoIdiomaInput,
  QualificacoesResumo,
} from '../types'

/**
 * Hook de Cursos e Qualificações: carrega a Visão geral (resumo + tabela de
 * funcionários) e a aba Pessoal (minhas formações/cursos/idiomas) do
 * colaborador logado, e expõe as ações de cadastro/exclusão.
 */
export function useCursos() {
  const [resumo, setResumo] = useState<QualificacoesResumo | null>(null)
  const [funcionarios, setFuncionarios] = useState<FuncionarioQualificacoes[]>([])
  const [formacoes, setFormacoes] = useState<FormacaoAcademica[]>([])
  const [cursos, setCursos] = useState<CursoQualificacao[]>([])
  const [idiomas, setIdiomas] = useState<Idioma[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)

    // Minhas qualificações (aba Pessoal) — todo mundo pode ver as próprias,
    // independente de papel.
    try {
      const minhas = await cursosService.getMinhas()
      setFormacoes(minhas.formacoes)
      setCursos(minhas.cursos)
      setIdiomas(minhas.idiomas)
    } catch (error) {
      console.error('Erro ao buscar suas qualificações', error)
    }

    // Visão geral (resumo + funcionários) — só quem modera (RH/DP/Admin, ver
    // PAPEIS_RH no backend). Busca à parte do bloco acima: um 403 aqui é
    // esperado pra quem não modera, e não pode derrubar a aba Pessoal junto
    // (por isso não está no mesmo Promise.all/try).
    try {
      const [resumoResp, funcionariosResp] = await Promise.all([
        cursosService.getResumo(),
        cursosService.getFuncionarios(),
      ])
      setResumo(resumoResp)
      setFuncionarios(funcionariosResp)
    } catch (error) {
      console.error('Erro ao buscar dados da Visão geral', error)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Cria a formação e, se um diploma foi selecionado, já envia o anexo em seguida. */
  async function criarFormacao(input: NovaFormacaoInput, arquivo?: File | null) {
    let criada = await cursosService.criarFormacao(input)
    if (arquivo) {
      criada = await cursosService.enviarAnexoFormacao(criada.id, arquivo)
    }
    setFormacoes((atual) => [criada, ...atual])
    return criada
  }

  async function excluirFormacao(id: string) {
    await cursosService.excluirFormacao(id)
    setFormacoes((atual) => atual.filter((item) => item.id !== id))
  }

  /** Edita a formação e, se um novo diploma foi selecionado, já envia o anexo em seguida. */
  async function editarFormacao(id: string, input: EditarFormacaoInput, arquivo?: File | null) {
    let editada = await cursosService.editarFormacao(id, input)
    if (arquivo) {
      editada = await cursosService.enviarAnexoFormacao(id, arquivo)
    }
    setFormacoes((atual) => atual.map((item) => (item.id === id ? editada : item)))
    return editada
  }

  /** Cria o curso/certificação e, se um certificado foi selecionado, já envia o anexo em seguida. */
  async function criarCurso(input: NovoCursoInput, arquivo?: File | null) {
    let criado = await cursosService.criarCurso(input)
    if (arquivo) {
      criado = await cursosService.enviarCertificadoCurso(criado.id, arquivo)
    }
    setCursos((atual) => [criado, ...atual])
    return criado
  }

  async function excluirCurso(id: string) {
    await cursosService.excluirCurso(id)
    setCursos((atual) => atual.filter((item) => item.id !== id))
  }

  async function criarOuAtualizarIdioma(input: NovoIdiomaInput) {
    const salvo = await cursosService.criarOuAtualizarIdioma(input)
    setIdiomas((atual) => [salvo, ...atual.filter((item) => item.id !== salvo.id)])
  }

  async function excluirIdioma(id: string) {
    await cursosService.excluirIdioma(id)
    setIdiomas((atual) => atual.filter((item) => item.id !== id))
  }

  return {
    resumo,
    funcionarios,
    formacoes,
    cursos,
    idiomas,
    isLoading,
    criarFormacao,
    excluirFormacao,
    editarFormacao,
    criarCurso,
    excluirCurso,
    criarOuAtualizarIdioma,
    excluirIdioma,
  }
}
