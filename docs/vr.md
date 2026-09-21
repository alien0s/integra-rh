
Documentação técnica do módulo de Vale-Refeição do Integra-RH: modelo de dados, regras de negócio, arquitetura (backend e front), permissões, migrations e como testar.


## 1-Visão Geral
O módulo de VR substitui o antigo sistema em Power Apps/SharePoint. Cada Mês tem um valor diário único para a empresa toda (e outro para Aprendiz/Estagiário) e um calendário de dias elegíveis, também único.
O que não é único por empresa é o fechamento: cada entidade (ACeAm, RADOAM, NT Store, etc.) fecha o VR do mês de forma independente das outras - uma auxiliar do departamento pessoal da ACeAm pode fechar os lançamentos e gerar arquivos essa semana e a assistente da RADOAM pode fazer isso em outra semana, sem nenhum tipo de bloqueio por parte do sistema.
Fluxo típico do mês

1. Cadastrar o mês - valor diário + calendário de dias elegíveis.
2. Lançar descontos/Extras por colaborador (individual ou em massa). 
3. Pré-visualizar o que o fechamento geraria (sem gravar nada)
4. Fechar por entidade - aplica os lançamentos pendentes daquela entidade em FIFO e gera o resultado de cada pessoa.
5. Baixar o relatório (PDF, CSV para a operadora, excel)
## 2-Modelo de dados
'vr_mes'
Cadastro Mensal - único por empresa toda

Coluna	Tipo	Observação
mes, ano	int	únicos juntos
valor_diario	numeric	valor padrão
valor_diario_aprendiz	numeric	valor pra Aprendiz/Estagiário
fechado	boolean	TRUE só quando todas as entidades que participam já fecharam

'vr_dia_elegivel'
Calendário de dias elegíveis do mês (1 linha por dia marcado). A quantidade de linhas = dias-base, igual para todo mundo
'vr_registro'
Resultado do fechamento, por pessoa e por mês (UNIQUE(user_id, vr_mes_id)). Só existe depois que a entidade da pessoa fechou.

Coluna	Cálculo
dias_vr	dias_base + qtd_extra - qtd_desconto (nunca negativo)
valor_a_receber	dias_vr × valor_diario (ou valor_diario_aprendiz)

'vr_lancamento'
Descontos/extras lançados manualmente pelo DP.

Coluna	Observação
tipo_lancamento	DESCONTO ou EXTRA
data_desconto	usada pro FIFO (mais antiga = aplicada primeiro)
mes_descontar_valor_id	mês em que deve ser considerado (migra pro mês seguinte se sobrar)
desconto_aplicado	TRUE depois que entra num fechamento — não pode ser cancelado nem duplicado depois disso

'vr_fechamento_entidade'
Controla o fechamento por entidade, dentro de 1 mês (UNIQUE(vr_mes_id, entity_id)).

Coluna	Observação
fechado	TRUE/FALSE — status daquela entidade naquele mês
fechado_em	timestamp de quando fechou

'entities.participa_vr'
Marca se uma entidade inteira nunca deve entrar no VR (ex.: UNoB). Padrão TRUE.
'users.participa_vr'
Marca se uma pessoa nunca deve entrar no VR, independente da entidade dela (ex.: Setor Distrital + Função Pastor Distrital). Padrão TRUE, recalculado automaticamente toda vez que atualizarUsuario() salva um setor/função novo — não precisa rodar SQL manual depois da migration inicial.
## 3- Regra de fechamento (FIFO)
Para cada colaborador da entidade sendo fechada:

qtd_extra      = quantidade de lançamentos EXTRA pendentes
capacidade     = dias_base + qtd_extra
qtd_desconto   = min(descontos pendentes, capacidade)   ← os mais ANTIGOS primeiro
excedente      = descontos que sobraram além da capacidade
dias_vr        = max(0, dias_base + qtd_extra - qtd_desconto)
valor_a_receber = dias_vr × valor_diario (ou valor_diario_aprendiz)



- FIFO: lançamentos com data_desconto mais antiga são aplicados primeiro. O que não coube fica pendente e migra pro vr_mes seguinte — que é criado automaticamente (copiando os valores diários) se ainda não existir. O calendário de dias elegíveis desse mês criado não vem automático — precisa cadastrar depois.
- Aprendiz/Estagiário: identificado por users.tipo_funcionario = 'APRENDIZ/ESTAGIÁRIO' (colaborador comum = 'COLABORADOR').
- Admissão/demissão no meio do mês: dias-base é sempre igual pra todo mundo — o ajuste é feito via lançamento manual de desconto, não é automático.
## 4- Fechamento por entidade - como o "Mês inteiro fechado" funciona
O 'vr_mes.fechado' vira TRUE automaticamente quando:

COUNT(entidades com colaborador ativo E participa_vr=TRUE)
  <=
COUNT(entidades já fechadas em vr_fechamento_entidade)


Isso só afeta a edição do mês (valor diário/dias elegíveis) — o fechamento em si já aconteceu entidade por entidade, de forma independente. Entidades e pessoas com participa_vr = FALSE nunca entram nessa contagem, então nunca travam esse cálculo.
## 5- Regras de bloqueio

Ação	Bloqueada quando...
Cadastrar novo mês (POST /vr)	já existe outro mês com fechado = FALSE
Editar mês (PATCH /vr/:id)	pelo menos 1 entidade já fechou esse mês
Fechar entidade (POST .../entidades/:id/fechar)	ela já está fechada, ou tem participa_vr = FALSE
Lançar desconto/extra (lote)	a entidade da pessoa já fechou o mês
Cancelar lançamento	ele já foi aplicado num fechamento (desconto_aplicado = TRUE)
Lançar data duplicada (mesma pessoa)	validado só no front: dentro do mesmo envio E contra lançamentos já existentes carregados no dialog
Motivo do lançamento	obrigatório nas 2 abas (Individual e Em massa) — validado no front

## 6- Backend — arquivos principais

apps/api/src/lib/vr.service.ts    # toda a lógica de negócio + queries
apps/api/src/lib/vr.export.ts     # geradores de PDF/CSV/Excel
apps/api/src/routes/vr.routes.ts  # endpoints HTTP
apps/api/src/lib/usuarios.ts      # atualizarUsuario() recalcula participa_vr
apps/api/src/scripts/test-vr.ts   # script de teste isolado (não afeta dados reais)


# Endpoints (todos exigem `podeGerenciarVr´)

apps/api/src/lib/vr.service.ts    # toda a lógica de negócio + queries
apps/api/src/lib/vr.export.ts     # geradores de PDF/CSV/Excel
apps/api/src/routes/vr.routes.ts  # endpoints HTTP
apps/api/src/lib/usuarios.ts      # atualizarUsuario() recalcula participa_vr
apps/api/src/scripts/test-vr.ts   # script de teste isolado (não afeta dados reais)


#Endpoints (todos exigem podeGerenciarVr)

Método	Rota	O que faz
GET	/vr	lista os meses
POST	/vr	cadastra mês novo
GET	/vr/:vrMesId	detalhe (com dias elegíveis)
PATCH	/vr/:vrMesId	edita valores/dias
GET	/vr/entidades	lista entidades que participam do VR
GET	/vr/:vrMesId/entidades-status	status aberta/fechada de cada entidade
POST	/vr/:vrMesId/entidades/:entityId/fechar	fecha 1 entidade
GET	/vr/:vrMesId/pre-visualizar?entityId=	simula sem gravar
GET	/vr/colaboradores?entityId=	seletor de pessoas pros lançamentos
GET	/vr/:vrMesId/lancamentos?entityId=	lista lançamentos do mês
POST	/vr/:vrMesId/lancamentos/lote	lança vários de uma vez
DELETE	/vr/lancamentos/:id	cancela um lançamento pendente
GET	/vr/lancamentos	todos os lançamentos, todos os meses
GET	/vr/:vrMesId/exportar/:formato?entityId=	baixa pdf/csv/xlsx

Permissão (podeGerenciarVr)
Libera pra:

- papelCodigo === "ADMIN"
- setor === "Inovação"
- setor === "Departamento Pessoal"
(constantes no topo de vr.routes.ts — fácil de ajustar se o nome do setor mudar)
## 7- FrontEnd - arquivos principais

apps/web/src/features/vr/
  types/VrTypes.ts              # todos os types compartilhados
  services/VrService.ts         # chamadas fetch pra API
  hooks/useVr.ts                # estado: meses, colaboradores, entidades
  components/
    NovoVrMesDialog.tsx         # cadastro (form à esquerda, calendário à direita)
    EditarVrMesDialog.tsx       # editar valores/dias (só se nada fechado ainda)
    FecharPorEntidadeDialog.tsx # pop-up: escolhe entidade → pré-visualiza → fecha → baixa
    LancamentosVrDialog.tsx     # abas Individual / Em massa + filtro de entidade
    TodosLancamentosDialog.tsx  # visão geral de todos os meses
    VrMesCard.tsx / VrMesList.tsx
apps/web/src/pages/vr/VrList.tsx  # página


Calendários usam locale={ptBR} (de date-fns/locale) — sem isso aparece em inglês.
## 8- Migrations aplicadas (ordem)

#	O que faz
010	Tabelas vr_mes, vr_dia_elegivel, vr_registro, vr_lancamento
011	FK de vr_registro/vr_lancamento pra users(id)
016	Tabela vr_fechamento_entidade
018	entities.participa_vr (+ UNoB marcada como FALSE)
019	users.participa_vr (+ Distrital/Pastor Distrital marcados como FALSE)

(entre 011 e 016 rodaram migrations de outros módulos — codigo_aps, tipo_funcionario, rename de departments→setor, etc., não listadas aqui por não serem do VR)
## 9- Como testar

pnpm --filter @erp/api test:vr


Cria um mês isolado (mês 1/ano 2099 — nunca colide com mês real), fecha a entidade de um colaborador real (só leitura, nunca altera ele), gera os 3 arquivos em /tmp/, e apaga tudo no final. Pra manter os dados de teste e inspecionar no DBeaver:

pnpm --filter @erp/api test:vr -- --manter


## 10- Pontos de atenção / suposições assumidas

- "Valor a Descontar" no PDF sempre sai R$ 0,00 — o modelo de dados guarda desconto em dias, não em valor monetário separado. Se surgir uma regra de desconto em dinheiro, precisa modelar isso à parte.
- CSV pula quem não tem codigo_aps preenchido — não bloqueia a exportação inteira, só aquela pessoa fica de fora do arquivo.
- TIPO_FUNCIONARIO_APRENDIZ está fixado como a string exata 'APRENDIZ/ESTAGIÁRIO' (com barra e acento) — se esse valor mudar no banco, precisa atualizar a constante em vr.service.ts.
- Validação de data duplicada em lançamentos é só no frontend — não existe constraint no banco impedindo 2 lançamentos idênticos via API direta (decisão consciente, pra não complicar com migration extra).
- Mês seguinte criado automaticamente (quando sobra excedente) não vem com dias elegíveis cadastrados — alguém precisa preencher esse calendário manualmente antes de fechar esse mês seguinte.



