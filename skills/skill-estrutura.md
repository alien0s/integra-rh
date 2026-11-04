Regras de organização de pastas, arquivos e componentes do frontend.# Estrutura de Pastas Frontend ERP

## 🎯 Objetivo Geral

Este documento define **regras rigorosas** de organização do frontend. O Codex DEVE consultar esta skill antes de criar qualquer componente, hook, página ou módulo RH. Cada arquivo tem propósito específico.

---

## Estrutura Base do apps/web

```
apps/web/src/
├── assets/                     # Imagens, ícones, fontes
├── components/                 # Componentes reutilizáveis globais
│   ├── ui/                     # Componentes shadcn (NUNCA edite)
│   ├── RH/                     # Componentes RH compartilhados
│   └── index.ts
├── config/                     # Configurações globais
├── context/                    # React Context (se usar)
├── docs/                       # Documentação do projeto
├── features/                   # 🔥 MÓDULOS RH (cada feature = feature independente)
│   ├── folha/                  # Módulo Folha de Pagamento
│   │   ├── index.tsx           # Export principal: FolhaPage
│   │   ├── components/         # Componentes específicos
│   │   ├── hooks/              # Hooks específicos
│   │   ├── services/           # Chamadas API (opcional)
│   │   ├── types/              # Types locais (opcional)
│   │   └── store/              # Zustand store (opcional)
│   ├── gestao/
│   ├── beneficios/
│   └── ...
├── hooks/                      # Hooks globais reutilizáveis
├── lib/                        # Utilities, helpers
├── pages/                      # 🔥 PÁGINAS PRINCIPAIS (List, Form, Detail)
│   ├── folha/                  # Páginas do módulo Folha
│   │   ├── FolhaList.tsx
│   │   ├── FolhaForm.tsx
│   │   └── FolhaDetail.tsx
│   ├── gestao/
│   ├── beneficios/
│   └── ...
├── store/                      # Zustand stores globais
├── types/                      # Types globais
├── styles/                     # CSS global
├── App.tsx
└── main.tsx
```

---

## 📋 Regras Obrigatórias

### 1. **Pastas — Responsabilidade Clara**

```
features/[modulo]/               ← LÓGICA: hooks, services, types, store
├── index.tsx                     # Export do componente Page
├── components/                   # Componentes específicos do módulo
├── hooks/                        # Lógica específica (fetch, estado)
├── services/                     # Chamadas API (CRUD)
├── types/                        # DTOs, enums locais
└── store/                        # Estado global (se necessário)

pages/[modulo]/                  ← UI: páginas públicas (List, Form, Detail)
├── FolhaList.tsx
├── FolhaForm.tsx
└── FolhaDetail.tsx
```

### 2. **Nomenclatura Rigorosa**

| Tipo | Padrão | Exemplo | Localização |
|------|--------|---------|-------------|
| Componentes | **PascalCase.tsx** | `FolhaList.tsx` | `features/folha/components/` |
| Páginas | **PascalCase.tsx** | `FolhaList.tsx` | `pages/folha/` |
| Hooks | **camelCase + `use`** | `useFolha.ts` | `features/folha/hooks/` |
| Services | **camelCase + `Service`** | `folhaService.ts` | `features/folha/services/` |
| Types | **PascalCase** | `FolhaStatus.ts` | `features/folha/types/` |
| Pastas (features) | **lowercase** | `features/folha/` | em `src/features/` |
| Pastas (pages) | **lowercase** | `pages/folha/` | em `src/pages/` |

### 3. **Imports — SEMPRE usar aliases**

✅ **CORRETO:**
```typescript
import { Button } from '@/components/ui/button'
import { FolhaCard } from '@/features/folha/components'
import { useFolha } from '@/features/folha/hooks'
import { folhaService } from '@/features/folha/services'
import { Funcionario } from '@shared/types'
import { api } from '@/lib/api'
```

❌ **ERRADO:**
```typescript
import { Button } from '../../../../components/ui/button'
import { FolhaCard } from '../folha/components/FolhaCard'
import { FolhaList } from '../pages/folha/FolhaList'
```

### 4. **Arquivo `index.ts` — OBRIGATÓRIO em pastas com múltiplos exports**

```typescript
// features/folha/components/index.ts
export { FolhaCard } from './FolhaCard'
export { FolhaFilters } from './FolhaFilters'
export { FolhaTable } from './FolhaTable'

// features/folha/hooks/index.ts
export { useFolha } from './useFolha'

// features/folha/services/index.ts
export { folhaService } from './folhaService'
```

### 5. **Ordem de imports em cada arquivo**

```typescript
// 1. Bibliotecas externas
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 2. shadcn/ui
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// 3. Types
import { Funcionario } from '@shared/types'
import type { FolhaFormData } from '@/features/folha/types'

// 4. Locais (store, hooks, services, utils)
import { useFolhaStore } from '@/store'
import { useFolha } from '@/features/folha/hooks'
import { folhaService } from '@/features/folha/services'
import { formatarData } from '@/lib/utils'

// 5. Componente
export function FolhaList() { }
```

### 6. **Quando usar `components/` vs `features/components/`**

- **Reutilizado em MÚLTIPLOS módulos** → `components/RH/`
- **Usado APENAS em UM módulo** → `features/[modulo]/components/`

```
❌ FuncionarioSelect em features/folha/components/
   (também é usado em gestao, beneficios, recrutamento)

✅ FuncionarioSelect em components/RH/

---

✅ FolhaFilters em features/folha/components/
   (apenas folha usa)

❌ FolhaFilters em components/RH/
```

### 7. **Dependências entre Módulos — CRÍTICO**

❌ **PROIBIDO** — módulos importando um do outro:
```typescript
// pages/folha/FolhaList.tsx
import { useFuncionario } from '@/features/gestao/hooks'  // ❌
```

✅ **CORRETO** — usar pastas compartilhadas:
```typescript
// components/RH/FuncionarioSelect.tsx
export function FuncionarioSelect() { }

// pages/folha/FolhaList.tsx
import { FuncionarioSelect } from '@/components/RH'  // ✅
```

### 8. **Abas condicionadas por papel — nunca sobrar 1 aba só**

Várias páginas (Cursos, Férias, e provavelmente outras no futuro) têm abas
(`Tabs`/`TabsList`/`TabsTrigger` do shadcn) onde uma ou mais só aparecem pra
certos papéis (ex.: "Visão geral" só pra ADMIN/RH/DP/COORDENADOR DP). Pra um
papel que não tem acesso a nenhuma das abas restritas (ex.: COLABORADOR),
sobra só 1 aba — e uma aba única não é navegação, é ruído visual (o usuário
vê uma barra de abas com um botão sozinho, sem nada pra alternar).

❌ **ERRADO** — `TabsList` sempre renderizada, mesmo com 1 `TabsTrigger` só:
```tsx
const ehDpRh = Boolean(usuario?.papelCodigo && PAPEIS_DP_RH.has(usuario.papelCodigo))
...
<TabsList>
  {ehDpRh && <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>}
  <TabsTrigger value="pessoal">Pessoal</TabsTrigger>   {/* fica sozinha pro COLABORADOR */}
</TabsList>
```

✅ **CORRETO** — calcule quantas abas sobram pro papel atual e esconda a
`TabsList` inteira (não só os `TabsTrigger` um a um) quando sobrar 1 só. Duas
formas já usadas no projeto, as duas válidas:

**a) `TabsList` condicional, mantendo o `<Tabs>` raiz** (`CursosList.tsx`) —
preferível quando o conteúdo das abas já está todo dentro de um único
componente filho controlado pelo próprio `Tabs` (`TabsContent` precisa do
contexto do `<Tabs>` pra funcionar, então ele continua no JSX; só a barra
de navegação some):
```tsx
<Tabs defaultValue={ehDpRh ? 'visao-geral' : 'pessoal'}>
  <AppLayout
    actions={
      ehDpRh ? (
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
        </TabsList>
      ) : undefined
    }
  >
    <ConteudoComAmbosOsTabsContent />
  </AppLayout>
</Tabs>
```

**b) Early return sem `<Tabs>` nenhum** (`FeriasList.tsx`) — preferível
quando o conteúdo de cada aba já é um componente próprio e independente
(não precisa do `<Tabs>` pra nada além de trocar de view):
```tsx
if (ehColaborador) {
  return (
    <AppLayout title="Férias">
      <FeriasPessoal />
    </AppLayout>
  )
}
return (
  <Tabs value={tab} onValueChange={handleTabChange}>
    <AppLayout tabs={<TabsList>...</TabsList>}>...</AppLayout>
  </Tabs>
)
```

Qualquer aba nova condicionada por papel (`{papelPermite && <TabsTrigger>}`)
precisa checar se, pro papel mais restrito do sistema (hoje COLABORADOR),
ainda sobra mais de 1 aba — se não sobrar, aplique a) ou b) acima.

---

## 🎯 Objetivo de Cada Arquivo/Pasta

### `features/[modulo]/index.tsx`
- **Propósito:** Exportar componente principal (Page wrapper)
- ✅ Export único: `export { [NomeComponent] }`
- ✅ Pode redirecionar para página
- ❌ Sem lógica de negócio
- ❌ Sem JSX complexo

### `pages/[modulo]/[NomePagina].tsx`
- **Propósito:** Páginas públicas (List, Form, Detail)
- ✅ Uma responsabilidade por página
- ✅ Usa hooks para dados
- ✅ Compõe componentes
- ✅ Gerencia estado da página
- ❌ Sem fetch direto (use hook)
- ❌ Sem lógica complexa

### `features/[modulo]/components/`
- **Propósito:** Componentes reutilizáveis DENTRO da feature
- ✅ Simples, focados em UI
- ✅ Props bem tipados
- ✅ Sem lógica de negócio
- ❌ Sem fetch API
- ❌ Sem dependências circulares

### `features/[modulo]/hooks/`
- **Propósito:** Lógica específica (fetch, estado, ações)
- ✅ Fetch, estado, ações (criar, editar, deletar)
- ✅ Usa services/
- ✅ Retorna dados + ações
- ✅ Sem JSX
- ❌ Sem imports de components

### `features/[modulo]/services/`
- **Propósito:** Chamadas API (CRUD)
- ✅ Funções claras (getAll, getById, create, update, delete)
- ✅ Types corretos em inputs/outputs
- ✅ Padronizado: retorna Promise
- ❌ Sem lógica de negócio
- ❌ Sem estado React

### `features/[modulo]/types/`
- **Propósito:** Types locais específicos
- ✅ DTOs (Create, Update)
- ✅ Enums (Status, Tipo)
- ✅ Types de formulário
- ❌ Sem modelos principais (use @shared/types)

### `features/[modulo]/store/`
- **Propósito:** Estado global da feature (Zustand)
- ✅ Só se múltiplas páginas/componentes compartilham
- ✅ Actions e getters claros
- ❌ Sem lógica complexa
- ❌ Sem fetch (deixa para hook)

---

## 📚 Fluxo de Dados — Ordem Correta

```
pages/[modulo]/[NomePagina].tsx
    ↓
    imports → useFolha (hook)
    ↓
features/folha/hooks/useFolha.ts
    ↓
    imports → folhaService (service)
    ↓
features/folha/services/folhaService.ts
    ↓
    imports → api (@/lib/api)
    ↓
    API Backend (GET, POST, PATCH, DELETE)
```

**Nunca pule etapas:**
- ❌ Página importando Service direto
- ❌ Página fazendo fetch direto
- ❌ Component importando Hook
- ✅ Página → Hook → Service → API

---

## ✅ Checklist — Antes de Criar

- [ ] **Propósito:** Qual é o objetivo do arquivo?
- [ ] **Pasta correta:** Está no lugar certo?
- [ ] **Nomenclatura:** Segue o padrão (PascalCase, camelCase)?
- [ ] **Imports:** Usa aliases (`@/`, `@shared/`)?
- [ ] **JSDoc:** Tem comentário explicando?
- [ ] **Sem dependências circulares:** Módulos NOT se importam?
- [ ] **Reutilizável?** Component em `components/RH/` ou `features/[modulo]/components/`?
- [ ] **Lógica específica?** Hook em `features/[modulo]/hooks/` ou `hooks/`?
- [ ] **index.ts criado?** Se múltiplos exports, tem `index.ts`?
- [ ] **Types corretos?** Em `@shared/types` ou `features/[modulo]/types/`?

---

## 📌 Boas Práticas (OBRIGATÓRIAS)

1. **Comentários JSDoc** — Todo arquivo/função explica propósito
2. **Props com interface** — Sempre defina `interface Props`
3. **Sem imports relativos** — Use SEMPRE aliases
4. **Um export por página** — `export function [NomeComponent]() {}`
5. **Separação clara** — Service = API, Hook = Estado, Component = UI, Page = Orquestra
6. **Reutilização primeiro** — Antes de criar, verifica se existe
7. **Sem fetch em componente** — Sempre use hook/service
8. **Validação de tipos** — Rodar `pnpm build` antes de commitar
9. **Sem lógica de negócio em Page** — Page = orquestra, lógica fica no hook
10. **Services = CRUD puro** — Sem tratamento de erro, sem toast, sem estado