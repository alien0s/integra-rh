import { useState } from 'react'
import { Database, Settings2, Table2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUsuarios } from '@/features/usuarios/hooks'

import { AppLayout } from '@/features/app/components/AppLayout'
import { ModulosVisibilidadeAdmin, RegistrosCard } from '@/features/tabelas/components'
import {
  useEntidades,
  useFuncoes,
  usePapeis,
  useSetores,
} from '@/features/tabelas/hooks'
import {
  GRUPOS_ENTIDADE,
  type Entidade,
  type EntidadeForm,
  type Funcao,
  type FuncaoForm,
  type Papel,
  type PapelForm,
  type Setor,
  type SetorForm,
} from '@/features/tabelas/types'

/** Opção "sem grupo" no dropdown (o Select não aceita value vazio). */
const SEM_GRUPO = '__sem_grupo__'
const SEM_GERENTE = '__sem_gerente__'
const SEM_COORDENADOR = '__sem_coordenador__'

/** Opções do dropdown de grupo: "Nenhum" + os grupos predefinidos. */
const OPCOES_GRUPO = [
  { value: SEM_GRUPO, label: 'Nenhum' },
  ...GRUPOS_ENTIDADE.map((g) => ({ value: g, label: g })),
]

/**
 * Tela administrativa de manutenção das tabelas de apoio do ERP: entidades,
 * setores, funções e papéis. O explorador lateral seleciona o painel de dados.
 * Os painéis permanecem montados para preservar rascunhos ao alternar tabelas.
 * Cada card é uma tabela editável in-line — sem modal ou dialog, a própria linha vira formulário
 * ao clicar em editar (ou em "Novo").
 */
export function TabelasList() {
  const [tabelaAtiva, setTabelaAtiva] = useState('entidades')
  const entidadesState = useEntidades()
  const setoresState = useSetores()
  const usuariosState = useUsuarios()
  const funcoesState = useFuncoes()
  const papeisState = usePapeis()

  const tabelas = [
    { id: 'entidades', nome: 'Entidades', total: entidadesState.entidades.length, carregando: entidadesState.isLoading, erro: entidadesState.error },
    { id: 'papeis', nome: 'Papéis', total: papeisState.papeis.length, carregando: papeisState.isLoading, erro: papeisState.error },
    { id: 'setores', nome: 'Setores', total: setoresState.setores.length, carregando: setoresState.isLoading, erro: setoresState.error },
    { id: 'funcoes', nome: 'Funções', total: funcoesState.funcoes.length, carregando: funcoesState.isLoading, erro: funcoesState.error },
  ]

  return (
    <AppLayout
      title="Tabelas"
      description="Home / Configurações / Tabelas"
      breadcrumbs={[{ label: 'Tabelas' }]}
    >
      <Tabs
        orientation="vertical"
        value={tabelaAtiva}
        onValueChange={setTabelaAtiva}
        className="grid min-w-0 items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]"
      >
        <Card className="min-w-0 shadow-none lg:sticky lg:top-6">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" aria-hidden="true" />
              Explorador de tabelas
            </CardTitle>
            <CardDescription>Selecione uma tabela para editar.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <TabsList aria-label="Tabelas disponíveis" className="h-auto w-full items-stretch gap-1 p-1">
              {tabelas.map((tabela) => (
                <TabsTrigger key={tabela.id} value={tabela.id} className="h-10 flex-none gap-2 px-3">
                  <Table2 data-icon="inline-start" aria-hidden="true" />
                  <span>{tabela.nome}</span>
                  <Badge variant="secondary" className="ml-auto tabular-nums" aria-label={tabela.erro ? 'Falha ao carregar registros' : tabela.carregando ? 'Carregando registros' : `${tabela.total} registros`}>
                    {tabela.erro ? '—' : tabela.carregando ? '…' : tabela.total}
                  </Badge>
                </TabsTrigger>
              ))}
              <Separator className="my-2" />
              <TabsTrigger value="modulos" className="h-10 flex-none gap-2 px-3">
                <Settings2 data-icon="inline-start" aria-hidden="true" />
                Acesso aos módulos
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        <div className="min-w-0">
          <TabsContent value="entidades" forceMount className="m-0 min-w-0 data-[state=inactive]:hidden">
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
              avisoExclusao="Atenção: isso também apaga em cascata as funções e usuários vinculados a esta entidade."
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

          </TabsContent>
          <TabsContent value="papeis" forceMount className="m-0 min-w-0 data-[state=inactive]:hidden">
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

          </TabsContent>
          <TabsContent value="setores" forceMount className="m-0 min-w-0 data-[state=inactive]:hidden">
            <RegistrosCard<Setor, SetorForm>
              titulo="Setores"
              descricao="Chefias opcionais. O coordenador mantém seu papel; o gerente recebe Departamental / Gerente."
              colunas={[
                { key: 'nome', label: 'Nome', type: 'text', required: true },
                {
                  key: 'managerId',
                  label: 'Coordenador',
                  type: 'select',
                  searchable: true,
                  searchPlaceholder: 'Pesquisar por nome ou e-mail…',
                  options: [
                    { value: SEM_COORDENADOR, label: 'Sem coordenador' },
                    ...usuariosState.usuarios.filter((usuario) => usuario.status === 'Ativo').map((usuario) => ({
                      value: usuario.id,
                      label: `${usuario.nome} (${usuario.email})`,
                    })),
                  ],
                },
                {
                  key: 'gestorId',
                  label: 'Gerente',
                  type: 'select',
                  searchable: true,
                  searchPlaceholder: 'Pesquisar por nome ou e-mail…',
                  options: [
                    { value: SEM_GERENTE, label: 'Sem gerente' },
                    ...usuariosState.usuarios.map((usuario) => ({
                      value: usuario.id,
                      label: `${usuario.nome} (${usuario.email})`,
                    })),
                  ],
                },
              ]}
              registros={setoresState.setores}
              isLoading={setoresState.isLoading || usuariosState.isLoading}
              error={setoresState.error || usuariosState.error}
              rascunhoVazio={{ nome: '', gestorId: SEM_GERENTE, managerId: SEM_COORDENADOR }}
              paraRascunho={(setor) => ({
                nome: setor.nome,
                gestorId: setor.gestorId ?? SEM_GERENTE,
                managerId: setor.managerId ?? SEM_COORDENADOR,
              })}
              exibir={(setor, coluna) => {
                if (coluna.key === 'managerId') return setor.managerNome || '—'
                if (coluna.key === 'gestorId') return setor.gestorNome || '—'
                return setor.nome
              }}
              rotuloRegistro="o setor"
              nomeExibicao={(setor) => setor.nome}
              onCriar={(rascunho) =>
                setoresState.criarSetor({
                  nome: rascunho.nome.trim(),
                  gestorId: rascunho.gestorId === SEM_GERENTE ? null : rascunho.gestorId,
                  managerId: rascunho.managerId === SEM_COORDENADOR ? null : rascunho.managerId,
                })
              }
              onAtualizar={(id, rascunho) =>
                setoresState.atualizarSetor(id, {
                  nome: rascunho.nome.trim(),
                  gestorId: rascunho.gestorId === SEM_GERENTE ? null : rascunho.gestorId,
                  managerId: rascunho.managerId === SEM_COORDENADOR ? null : rascunho.managerId,
                })
              }
              onExcluir={setoresState.excluirSetor}
            />

          </TabsContent>
          <TabsContent value="funcoes" forceMount className="m-0 min-w-0 data-[state=inactive]:hidden">
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
          </TabsContent>
          <TabsContent value="modulos" forceMount className="m-0 min-w-0 data-[state=inactive]:hidden">
            <ModulosVisibilidadeAdmin papeis={papeisState.papeis} />
          </TabsContent>
        </div>
      </Tabs>
    </AppLayout>
  )
}
