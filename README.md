> ⚠️ **REPOSITÓRIO ARQUIVADO — 2026-08-19**
>
> Este backend foi decomissionado. Toda a funcionalidade foi migrada para o
> app fullstack Next.js em [`Antares-frontend`](https://github.com/smdu-sp/Antares-frontend)
> — Route Handlers em `app/api/**` chamando Prisma diretamente, sem servidor
> HTTP separado. Este repositório é mantido só como referência histórica:
> não deve receber novas alterações nem ser reimplantado em produção.

# Antares Backend

Sistema de gerenciamento de processos e andamentos - SMUL/ATIC

<p align="center">
  <a href="https://www.prefeitura.sp.gov.br/cidade/secretarias/licenciamento/" target="blank">
    <img src="https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/chamadas/URBANISMO_E_LICENCIAMENTO_HORIZONTAL_FUNDO_CLARO_1665756993.png" width="300" alt="SMUL Logo" />
  </a>
</p>

## 🚀 Tecnologias

<p align="left">
  <a href="https://docs.nestjs.com/" target="_blank" title="NestJS">
    <img src="https://docs.nestjs.com/assets/logo-small-gradient.svg" alt="NestJS" width="40" height="40" />
  </a>
  <a href="https://www.prisma.io/docs" target="_blank" title="Prisma">
    <img src="https://www.prisma.io/docs/img/logo-white.svg" alt="Prisma" width="40" height="40" />
  </a>
</p>

- **NestJS** - Framework Node.js progressivo
- **Prisma** - ORM moderno para TypeScript
- **MySQL** - Banco de dados relacional
- **JWT** - Autenticação via tokens
- **LDAP/AD** - Integração com Active Directory
- **Swagger** - Documentação automática da API

## 📚 Contratos de integração

- Frontend (acesso por sistema + grupos): `docs/frontend-contrato-acesso-grupos.md`

## 📋 Pré-requisitos

- Node.js 18+
- MySQL 8+
- npm, yarn, pnpm ou bun

## 🔧 Instalação

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
copy example.env .env
```

### 3. Gerar secrets JWT

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# RT_SECRET (refresh token)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole os valores gerados no arquivo `.env`.

### 4. Configurar banco de dados

Edite o `.env` com suas credenciais MySQL:

```env
DATABASE_URL=mysql://user:password@localhost:3306/antares
SGU_DATABASE_URL=mysql://user:password@host:3306/SGU
```

### 5. Executar migrations

```bash
npx prisma migrate dev
```

### 6. Gerar Prisma Clients

```bash
npx prisma generate --schema=./prisma/schema.prisma
npx prisma generate --schema=./prisma/sgu/schema.prisma
```

### 7. Popular banco (opcional)

```bash
npx prisma db seed
```

## 🏃 Executando a aplicação

```bash
# Desenvolvimento (hot reload)
npm run dev

# Produção
npm run build
npm run start:prod
```

Acesse: [http://localhost:3000](http://localhost:3000)

## � Deploy para Produção

**📖 Guia completo**: [DEPLOY.md](./DEPLOY.md)

**⚡ Verificação rápida** - Execute antes do deploy:

```powershell
# Windows PowerShell
.\pre-deploy-check.ps1

# Linux/Mac
chmod +x pre-deploy-check.sh
./pre-deploy-check.sh
```

### ✅ Checklist Pré-Deploy

#### 1. Variáveis de Ambiente

```bash
# ⚠️ IMPORTANTE: Gerar novos secrets para produção
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # RT_SECRET
```

Configure o `.env` de produção:

```env
# Banco de dados
DATABASE_URL=mysql://user:password@host:3306/antares
SGU_DATABASE_URL=mysql://user:password@host:3306/SGU

# Secrets (GERAR NOVOS!)
JWT_SECRET=<seu_secret_aqui>
RT_SECRET=<seu_refresh_token_secret_aqui>

# Ambiente
ENVIRONMENT=production

# LDAP/Active Directory
LDAP_SERVER=ldap://seu-servidor:389
LDAP_DOMAIN=@seu-dominio
LDAP_BASE=DC=seu,DC=dominio
USER_LDAP=usuario_servico
PASS_LDAP=senha_servico
```

#### 2. Executar Migrations Pendentes

```bash
# ⚠️ Backup do banco antes de rodar migrations!
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**Migrations recentes:**

- ✅ `20260223155307_add_preferencias_usuario` - Sistema de preferências do usuário
- ✅ `20260220155731_add_assunto_to_andamento` - Campo assunto em andamentos
- ✅ Outras migrations anteriores (ver pasta `prisma/migrations/`)

#### 3. Gerar Prisma Clients

```bash
npx prisma generate --schema=./prisma/schema.prisma
npx prisma generate --schema=./prisma/sgu/schema.prisma
```

#### 4. Build da Aplicação

```bash
# Instalar dependências (produção apenas)
npm ci --production=false

# Build
npm run build

# Testar build localmente
npm run start:prod
```

#### 5. Verificações Finais

**Checklist:**

- [ ] `.env` configurado com secrets novos
- [ ] Migrations aplicadas com sucesso
- [ ] Prisma clients gerados
- [ ] Build executado sem erros
- [ ] Conexão LDAP testada
- [ ] Conexão com banco de dados testada
- [ ] Porta 3000 disponível (ou configurar `PORT` no `.env`)

### 🔍 Testes Pós-Deploy

```bash
# Testar autenticação
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"usuario","senha":"senha"}'

# Verificar saúde da API
curl http://localhost:3000/

# Acessar documentação Swagger
# http://localhost:3000/api
```

### 📊 Novos Endpoints (Features Recentes)

#### **Preferências de Usuário** (Persistência de configurações)

```bash
POST   /preferencias           # Salvar preferência
GET    /preferencias           # Listar todas
GET    /preferencias/:chave    # Buscar específica
DELETE /preferencias/:chave    # Deletar específica
DELETE /preferencias           # Deletar todas
```

#### **Exportação** (Excel/PDF)

```bash
GET /export/processos/excel     # Exportar processos para Excel
GET /export/processos/pdf       # Exportar processos para PDF
GET /export/andamentos/excel    # Exportar andamentos para Excel
GET /export/andamentos/pdf      # Exportar andamentos para PDF
```

#### **Contadores para Dashboard**

**Processos:**

```bash
GET /processos/contar/total           # Total de processos
GET /processos/contar/em-andamento    # Em andamento (não concluídos, não atrasados)
GET /processos/contar/vencendo-hoje   # Vencendo hoje
GET /processos/contar/atrasados       # Atrasados sem resposta
GET /processos/contar/concluidos      # Concluídos (com data_resposta_final)
```

**Andamentos:**

```bash
GET /andamentos/contar/concluidos      # Status CONCLUIDO
GET /andamentos/contar/vencidos        # Não concluídos, prazo vencido
GET /andamentos/contar/vencendo-hoje   # Não concluídos, prazo hoje
GET /andamentos/contar/em-andamento    # Não concluídos, prazo futuro
```

### 🐳 Deploy com Docker (Opcional)

```bash
# Build da imagem
docker build -t antares-backend .

# Executar container
docker run -d \
  --name antares-backend \
  -p 3000:3000 \
  --env-file .env \
  antares-backend
```

### 🔄 Rollback em Caso de Problemas

```bash
# Reverter última migration
npx prisma migrate resolve --rolled-back <migration_name>

# Restaurar backup do banco
mysql -u user -p antares < backup.sql
```

## �📚 Documentação da API

Swagger disponível em: [http://localhost:3000/api](http://localhost:3000/api)

## 🔐 Autenticação

O sistema usa autenticação JWT com integração LDAP/Active Directory.

### Ambiente Local (sem LDAP)

```env
ENVIRONMENT=local
```

### Produção (com LDAP)

```env
ENVIRONMENT=production
LDAP_SERVER=ldap://servidor
LDAP_DOMAIN=@dominio
```

## 🗄️ Estrutura do Projeto

```
src/
├── andamentos/      # Gestão de andamentos de processos
├── auth/            # Autenticação e autorização (JWT + LDAP)
├── export/          # Exportação de dados (Excel/PDF)
├── interessados/    # Gestão de interessados
├── logs/            # Sistema de auditoria
├── preferencias/    # Preferências do usuário (configurações persistentes)
├── prisma/          # Serviços Prisma (ORM)
├── processos/       # Gestão de processos
├── unidades/        # Cadastro de unidades
└── usuarios/        # Gestão de usuários
```

## 🛠️ Scripts Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia com hot reload
npm run build            # Compila para produção
npm run start:debug      # Inicia com debugger

# Banco de dados
npx prisma studio        # Interface visual do banco
npx prisma migrate dev   # Criar nova migration
npx prisma db seed       # Popular banco com dados iniciais

# Code quality
npm run lint             # Verificar código
npm run format           # Formatar código
```

## 📦 Múltiplos Schemas Prisma

O projeto usa dois schemas:

1. **Antares** (`prisma/schema.prisma`) - Banco principal
2. **SGU** (`prisma/sgu/schema.prisma`) - Sistema de Gestão de Usuários

Sempre gere ambos após alterações:

```bash
npx prisma generate --schema=./prisma/schema.prisma
npx prisma generate --schema=./prisma/sgu/schema.prisma
```

## 🚨 Troubleshooting

### Erro: "Cannot find module '@prisma/sgu/client'"

```bash
npx prisma generate --schema=./prisma/sgu/schema.prisma
```

### Problemas com LDAP

Verifique conectividade:

```bash
Test-NetConnection -ComputerName 10.10.65.242 -Port 389
```

### Migration conflicts

```bash
npx prisma migrate reset --schema=./prisma/schema.prisma
```

## 📝 Licença

Propriedade da Prefeitura Municipal de São Paulo - SMUL/ATIC

---

**Desenvolvido por**: SMUL/ATIC
