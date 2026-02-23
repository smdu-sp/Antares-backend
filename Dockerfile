# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci --production=false

# Copiar código fonte
COPY . .

# Gerar Prisma Clients
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npx prisma generate --schema=./prisma/sgu/schema.prisma

# Build da aplicação
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm ci --production=true

# Copiar Prisma schemas
COPY prisma ./prisma/

# Gerar Prisma Clients novamente no container final
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npx prisma generate --schema=./prisma/sgu/schema.prisma

# Copiar build da aplicação
COPY --from=builder /app/dist ./dist

# Criar diretório de logs
RUN mkdir -p logs

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Comando para executar a aplicação
CMD ["node", "dist/main"]
