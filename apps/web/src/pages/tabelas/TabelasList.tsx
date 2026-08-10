import { AppLayout } from '@/features/app/components/AppLayout'
import { RegistrosCard } from '@/features/tabelas/components'
import {
  useDepartamentos,
  useEntidades,
  useFuncoes,
  usePapeis,
} from '@/features/tabelas/hooks'
import {
  GRUPOS_ENTIDADE,
  type Departamento,
  type DepartamentoForm,
  type Entidade,
  type EntidadeForm,
  type Funcao,
  type FuncaoForm,
  type Papel,
  type PapelForm,
} from '@/features/tabelas/types'

/** Opção "sem grupo" no dropdown (o Select não aceita value vazio). */
const SEM_GRUPO = '__sem_grupo__'

/** Opções do dropdown de grupo: "Nenhum" + os grupos predefinidos. */
const OPCOES_GRUPO = [
  { value: SEM_GRUPO, label: 'Nenhum' },
  ...GRUPOS_ENTIDADE.map((g) => ({ value: g, label: g })),
]

/**
 * Tela administrativa de manutenção das tabelas de apoio do ERP: entidades,
 * departamentos, funções e papéis. Cada card é uma tabela totalmente
 * editável in-line — sem modal ou dialog, a própria linha vira formulário
 * ao clicar em editar (ou em "Novo").
 */
export function TabelasList() {
  const entidadesState = useEntidades()
  const departamentosState = useDepartamentos()
  const funcoesState = useFuncoes()
  const papeisState = usePapeis()

  return (
    <AppLayout
      title="Tabelas"
      description="Home / Configurações / Tabelas"
      breadcrumbs={[{ label: 'Tabelas' }]}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RegistrosCard<Entidade, EntidadeForm>
          titulo="Entidades"
          descricao="Empresas/organizações do ERP."
          colunas={[
            { key: 'nome', label: 'Nome', type: 'text', required: true },
            { key: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00' },
            {
              key: 'grupo',
              label: 'Grupo',
              type: 'select',
              placeholder: 'Selecione',
              options: OPCOES_GRUPO,
              className: 'w-40',
            },
            {
              key: 'codigoAps',
              label: 'Cód. APS',
              type: 'number',
              placeholder: '164122',
              className: 'w-28',
            },
          ]}
          registros={entidadesState.entidades}
          isLoading={entidadesState.isLoading}
          error={entidadesState.error}
          rascunhoVazio={{ nome: '', cnpj: '', grupo: SEM_GRUPO, codigoAps: '' }}
          paraRascunho={(entidade) => ({
            nome: entidade.nome,
            cnpj: entidade.cnpj ?? '',
            grupo: entidade.grupo ?? SEM_GRUPO,
            codigoAps: entidade.codigoAps != null ? String(entidade.codigoAps) : '',
          })}
          exibir={(entidade, coluna) => {
            if (coluna.key === 'cnpj') return entidade.cnpj || '—'
            if (coluna.key === 'grupo') return entidade.grupo || '—'
            if (coluna.key === 'codigoAps') return entidade.codigoAps ?? '—'
            return entidade.nome
          }}
          rotuloRegistro="a entidade"
          nomeExibicao={(entidade) => entidade.nome}
          avisoExclusao="Atenção: isso também apaga em cascata os departamentos, funções e usuários vinculados a esta entidade."
          onCriar={(rascunho) =>
            entidadesState.criarEntidade({
              nome: rascunho.nome.trim(),
              cnpj: rascunho.cnpj.trim() || null,
              grupo: rascunho.grupo === SEM_GRUPO ? null : rascunho.grupo,
              codigoAps: rascunho.codigoAps.trim() ? Number(rascunho.codigoAps) : null,
            })
          }
          onAtualizar={(id, rascunho) =>
            entidadesState.atualizarEntidade(id, {
              nome: rascunho.nome.trim(),
              cnpj: rascunho.cnpj.trim() || null,
              grupo: rascunho.grupo === SEM_GRUPO ? null : rascunho.grupo,
              codigoAps: rascunho.codigoAps.trim() ? Number(rascunho.codigoAps) : null,
            })
          }
          onExcluir={entidadesState.excluirEntidade}
        />

        <RegistrosCard<Papel, PapelForm>
          titulo="Papéis"
          descricao="Perfis de acesso disponíveis para os usuários."
          colunas={[
            { key: 'codigo', label: 'Código', type: 'text', required: true },
            { key: 'nome', label: 'Nome', type: 'text', required: true },
            { key: 'nivel', label: 'Nível', type: 'number', required: true, className: 'w-24' },
          ]}
          registros={papeisState.papeis}
          isLoading={papeisState.isLoading}
          error={papeisState.error}
          rascunhoVazio={{ codigo: '', nome: '', nivel: '0' }}
          paraRascunho={(papel) => ({
            codigo: papel.codigo,
            nome: papel.nome,
            nivel: String(papel.nivel),
          })}
          rotuloRegistro="o papel"
          nomeExibicao={(papel) => papel.nome}
          onCriar={(rascunho) =>
            papeisState.criarPapel({
              codigo: rascunho.codigo.trim().toUpperCase(),
              nome: rascunho.nome.trim(),
              nivel: Number(rascunho.nivel) || 0,
            })
          }
          onAtualizar={(id, rascunho) =>
            papeisState.atualizarPapel(id, {
              codigo: rascunho.codigo.trim().toUpperCase(),
              nome: rascunho.nome.trim(),
              nivel: Number(rascunho.nivel) || 0,
            })
          }
          onExcluir={papeisState.excluirPapel}
        />

        <RegistrosCard<Departamento, DepartamentoForm>
          titulo="Departamentos"
          descricao="Setores da empresa, usados no cadastro de usuários."
          colunas={[
            { key: 'nome', label: 'Nome', type: 'text', required: true },
            { key: 'descricao', label: 'Descrição', type: 'text' },
          ]}
          registros={departamentosState.departamentos}
          isLoading={departamentosState.isLoading}
          error={departamentosState.error}
          rascunhoVazio={{ nome: '', descricao: '' }}
          paraRascunho={(departamento) => ({
            nome: departamento.nome,
            descricao: departamento.descricao ?? '',
          })}
          exibir={(departamento, coluna) => {
            if (coluna.key === 'descricao') return departamento.descricao || '—'
            return departamento.nome
          }}
          rotuloRegistro="o departamento"
          nomeExibicao={(departamento) => departamento.nome}
          onCriar={(rascunho) =>
            departamentosState.criarDepartamento({
              nome: rascunho.nome.trim(),
              descricao: rascunho.descricao.trim() || null,
            })
          }
          onAtualizar={(id, rascunho) =>
            departamentosState.atualizarDepartamento(id, {
              nome: rascunho.nome.trim(),
              descricao: rascunho.descricao.trim() || null,
            })
          }
          onExcluir={departamentosState.excluirDepartamento}
        />

        <RegistrosCard<Funcao, FuncaoForm>
          titulo="Funções"
          descricao="Cargos disponíveis na empresa."
          colunas={[
            { key: 'nome', label: 'Nome', type: 'text', required: true },
            { key: 'descricao', label: 'Descrição', type: 'text' },
          ]}
          registros={funcoesState.funcoes}
          isLoading={funcoesState.isLoading}
          error={funcoesState.error}
          rascunhoVazio={{ nome: '', descricao: '' }}
          paraRascunho={(funcao) => ({
            nome: funcao.nome,
            descricao: funcao.descricao ?? '',
          })}
          exibir={(funcao, coluna) => {
            if (coluna.key === 'descricao') return funcao.descricao || '—'
            return funcao.nome
          }}
          rotuloRegistro="a função"
          nomeExibicao={(funcao) => funcao.nome}
          onCriar={(rascunho) =>
            funcoesState.criarFuncao({
              nome: rascunho.nome.trim(),
              descricao: rascunho.descricao.trim() || null,
            })
          }
          onAtualizar={(id, rascunho) =>
            funcoesState.atualizarFuncao(id, {
              nome: rascunho.nome.trim(),
              descricao: rascunho.descricao.trim() || null,
            })
          }
          onExcluir={funcoesState.excluirFuncao}
        />
      </div>
    </AppLayout>
  )
}
