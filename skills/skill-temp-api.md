Guia completo para configurar backend com Node.js, Fastify, LDAP e JWT.# Setup API Node.js + Fastify para Codex IA

## 🎯 Objetivo

Configurar um backend **Fastify** que integra:
- ✅ Autenticação LDAP (AD On-Premises)
- ✅ JWT tokens
- ✅ PostgreSQL (Supabase)
- ✅ CORS para frontend React

---

## 1️⃣ Estrutura Base do Projeto

```
apps/
├── web/                  # Frontend React
├── api/                  # Backend Node.js + Fastify
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts       # Rotas de autenticação
│   │   │   └── tickets.ts    # Rotas de tickets (exemplo)
│   │   ├── middleware/
│   │   │   └── auth.ts       # Middleware JWT
│   │   ├── lib/
│   │   │   ├── ldap.ts       # Conexão LDAP
│   │   │   └── db.ts         # Conexão PostgreSQL
│   │   └── server.ts         # Servidor principal
│   ├── .env               # Variáveis de ambiente
│   ├── package.json
│   └── tsconfig.json
```

---

## 2️⃣ Instalação e Setup Inicial

### A) Criar projeto Node.js + Fastify

```bash
cd apps/api
npm init -y
npm install fastify @fastify/cors @fastify/jwt jsonwebtoken ldapjs dotenv pg
npm install -D typescript @types/node ts-node
```

### B) Criar `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### C) Atualizar `package.json`

```json
{
  "name": "api-erp",
  "version": "1.0.0",
  "description": "API Backend para ERP com LDAP",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/**/*.ts"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@fastify/cors": "^8.4.2",
    "@fastify/jwt": "^7.0.3",
    "fastify": "^4.24.3",
    "jsonwebtoken": "^9.1.0",
    "ldapjs": "^3.0.7",
    "dotenv": "^16.3.1",
    "pg": "^8.11.2"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "typescript": "^5.2.2",
    "ts-node": "^10.9.1"
  }
}
```

---

## 3️⃣ Configurar Variáveis de Ambiente

### Arquivo: `apps/api/.env`

```bash
# ===== FASTIFY =====
NODE_ENV=development
PORT=3000

# ===== LDAP / AD On-Premises =====
LDAP_URL=ldap://seu-servidor-ad.com:389
LDAP_BIND_DN=cn=serviceaccount,cn=users,dc=adventistas,dc=local
LDAP_BIND_CREDENTIALS=senha-service-account
LDAP_SEARCH_BASE=cn=users,dc=adventistas,dc=local
LDAP_SEARCH_FILTER=(mail={{email}})

# ===== JWT =====
JWT_SECRET=sua-chave-super-secreta-aleatoria-change-me
JWT_EXPIRES_IN=1h

# ===== PostgreSQL / Supabase =====
DATABASE_URL=postgresql://user:password@localhost:5432/erp
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_KEY=sua-chave-service

# ===== CORS =====
FRONTEND_URL=http://localhost:5173
```

---

## 4️⃣ Implementar LDAP + JWT

### Arquivo: `apps/api/src/lib/ldap.ts`

```typescript
/**
 * ldap.ts
 * 
 * Conexão e validação LDAP contra AD On-Premises
 */

import * as ldap from 'ldapjs'

interface LdapConfig {
  url: string
  bindDN: string
  bindCredentials: string
  searchBase: string
  searchFilter: string
}

const ldapConfig: LdapConfig = {
  url: process.env.LDAP_URL || 'ldap://localhost:389',
  bindDN: process.env.LDAP_BIND_DN || '',
  bindCredentials: process.env.LDAP_BIND_CREDENTIALS || '',
  searchBase: process.env.LDAP_SEARCH_BASE || '',
  searchFilter: process.env.LDAP_SEARCH_FILTER || '(mail={{email}})'
}

function createLdapClient(): ldap.Client {
  return ldap.createClient({
    url: ldapConfig.url,
    timeout: 5000,
    connectTimeout: 5000
  })
}

/**
 * Buscar usuário no LDAP pelo email
 */
export async function searchUserInLdap(email: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const client = createLdapClient()

    client.bind(ldapConfig.bindDN, ldapConfig.bindCredentials, (err) => {
      if (err) {
        client.unbind()
        reject(new Error('LDAP bind failed'))
        return
      }

      const filter = ldapConfig.searchFilter.replace('{{email}}', email)
      const opts = {
        filter,
        scope: 'sub' as const,
        attributes: ['dn', 'cn', 'mail']
      }

      let userDN: string | null = null

      client.search(ldapConfig.searchBase, opts, (err, res) => {
        if (err) {
          client.unbind()
          reject(err)
          return
        }

        res.on('searchEntry', (entry) => {
          userDN = entry.dn
        })

        res.on('error', (err) => {
          client.unbind()
          reject(err)
        })

        res.on('end', () => {
          client.unbind()
          resolve(userDN)
        })
      })
    })
  })
}

/**
 * Validar senha do usuário contra LDAP (bind)
 */
export async function validateLdapPassword(
  userDN: string,
  password: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const client = createLdapClient()

    client.bind(userDN, password, (err) => {
      client.unbind()
      resolve(!err) // Se erro, resolve false; se OK, resolve true
    })
  })
}

/**
 * Função combinada: buscar + validar
 */
export async function authenticateWithLdap(
  email: string,
  password: string
): Promise<boolean> {
  try {
    const userDN = await searchUserInLdap(email)
    if (!userDN) {
      return false
    }

    return await validateLdapPassword(userDN, password)
  } catch (err) {
    console.error('LDAP auth error:', err)
    return false
  }
}
```

### Arquivo: `apps/api/src/lib/db.ts`

```typescript
/**
 * db.ts
 * 
 * Conexão com PostgreSQL
 */

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

export async function getUserByEmail(email: string) {
  const query = 'SELECT * FROM users WHERE email = $1'
  const result = await pool.query(query, [email])
  return result.rows[0]
}

export async function updateLastLogin(userId: string) {
  const query = 'UPDATE users SET last_login_at = NOW() WHERE id = $1'
  await pool.query(query, [userId])
}

export { pool }
```

---

## 5️⃣ Implementar Rotas de Autenticação

### Arquivo: `apps/api/src/routes/auth.ts`

```typescript
/**
 * auth.ts
 * 
 * Rotas de autenticação com LDAP + JWT
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { authenticateWithLdap } from '../lib/ldap'
import { getUserByEmail, updateLastLogin } from '../lib/db'

interface LoginRequest {
  email: string
  password: string
}

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/login
   * 
   * Recebe email + senha
   * Valida contra LDAP
   * Retorna JWT token
   */
  app.post<{ Body: LoginRequest }>('/auth/login', async (req, res) => {
    const { email, password } = req.body

    // Validar requisição
    if (!email || !password) {
      return res.status(400).send({
        error: 'Email e senha são obrigatórios'
      })
    }

    // Validar email no banco
    const user = await getUserByEmail(email)
    if (!user) {
      return res.status(401).send({
        error: 'Credenciais inválidas'
      })
    }

    // Validar contra LDAP
    const isValidPassword = await authenticateWithLdap(email, password)
    if (!isValidPassword) {
      return res.status(401).send({
        error: 'Credenciais inválidas'
      })
    }

    // Atualizar last_login
    await updateLastLogin(user.id)

    // Gerar JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        nome: user.nome,
        departamento: user.departamento
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    )

    // Retornar token + dados
    return res.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        departamento: user.departamento,
        funcao: user.funcao,
        avatar: user.avatar
      }
    })
  })

  /**
   * POST /auth/refresh
   * 
   * Renovar token (com middleware de auth)
   */
  app.post('/auth/refresh', { onRequest: [app.authenticate] }, async (req, res) => {
    const user = req.user

    const newToken = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    )

    return res.send({ token: newToken })
  })

  /**
   * GET /auth/me
   * 
   * Dados do usuário logado
   */
  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req, res) => {
    const user = await getUserByEmail(req.user.email)
    return res.send(user)
  })
}
```

---

## 6️⃣ Middleware de Autenticação

### Arquivo: `apps/api/src/middleware/auth.ts`

```typescript
/**
 * auth.ts
 * 
 * Middleware para validar JWT
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

interface AuthPayload {
  id: string
  email: string
}

declare global {
  namespace FastifyInstance {
    interface FastifyRequest {
      user?: AuthPayload
    }
  }
}

export async function authenticateToken(
  req: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return reply.status(401).send({ error: 'Token não fornecido' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret')
    ;(req as any).user = decoded
  } catch (err) {
    return reply.status(401).send({ error: 'Token inválido' })
  }
}
```

---

## 7️⃣ Servidor Principal

### Arquivo: `apps/api/src/server.ts`

```typescript
/**
 * server.ts
 * 
 * Inicialização do servidor Fastify
 */

import 'dotenv/config'
import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import { authRoutes } from './routes/auth'
import { authenticateToken } from './middleware/auth'

const app = Fastify({
  logger: true
})

// Registrar middleware CORS
app.register(fastifyCors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
})

// Registrar decorador de autenticação
app.decorate('authenticate', authenticateToken)

// Registrar rotas
app.register(authRoutes)

// Health check
app.get('/health', async () => {
  return { status: 'ok' }
})

// Iniciar servidor
const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' })
    console.log(`✅ Servidor rodando em http://localhost:${process.env.PORT || 3000}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

---

## 8️⃣ Executar Backend

```bash
cd apps/api

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Fazer build
npm run build

# Rodar em produção
npm start
```

---

## 9️⃣ Testar Autenticação

### Com cURL

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@adventistas.org",
    "password": "senha-do-ad"
  }'

# Resposta esperada:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "user": {
#     "id": "uuid",
#     "email": "usuario@adventistas.org",
#     "nome": "Nome Completo",
#     "departamento": "TI"
#   }
# }

# Usar token
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

## 🔟 Conectar ao Frontend React

### Arquivo: `apps/web/src/hooks/useLogin.ts`

```typescript
import { useState, useCallback } from 'react'

export function useLogin() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        }
      )

      if (!response.ok) {
        throw new Error('Login falhou')
      }

      const data = await response.json()
      localStorage.setItem('token', data.token)
      setToken(data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  return { token, loading, error, login }
}
```

### Arquivo: `apps/web/.env.local`

```
VITE_API_URL=http://localhost:3000
```

---

## ✅ Checklist Final

- [ ] Node.js + npm instalado
- [ ] Fastify instalado
- [ ] `.env` configurado com LDAP
- [ ] PostgreSQL rodando (ou Supabase)
- [ ] `npm run dev` funcionando
- [ ] POST `/auth/login` retorna token
- [ ] Frontend conecta ao backend
- [ ] CORS habilitado
- [ ] JWT validando corretamente

**Pronto! Seu backend está pronto para autenticar contra LDAP!** 🚀