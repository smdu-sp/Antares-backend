# 📝 Módulo de Logs - Sistema de Auditoria

## 📋 Visão Geral

O módulo de logs fornece um sistema completo de auditoria e rastreabilidade para o sistema Antares. Todas as ações importantes realizadas pelos usuários são automaticamente registradas para fins de segurança, conformidade e análise.

## 🎯 Funcionalidades

- ✅ **Registro Automático**: Todas as operações CRUD são automaticamente registradas
- ✅ **Histórico Completo**: Armazena estado anterior e novo dos dados
- ✅ **Rastreabilidade**: Identifica quem fez o quê e quando
- ✅ **Consultas Flexíveis**: Busca por tipo, entidade, usuário ou período
- ✅ **Performance**: Sistema otimizado com índices no banco de dados

## 📁 Estrutura de Arquivos

```
src/logs/
├── dto/
│   ├── create-log.dto.ts        # DTO para criação de logs
│   ├── log-response.dto.ts      # DTOs de resposta
│   └── filter-log.dto.ts        # DTO para filtros de busca
├── logs.controller.ts           # Controller com endpoints REST
├── logs.service.ts              # Service com lógica de negócio
└── logs.module.ts               # Módulo NestJS
```

## 🔧 Como Usar

### Registrando um Log (uso interno)

O `LogsService` é injetado automaticamente nos services de processos e andamentos. Para registrar uma ação:

```typescript
await this.logsService.criar(
  $Enums.TipoAcao.PROCESSO_CRIADO, // Tipo da ação
  'Processo criado: 123456 - Assunto', // Descrição
  'processo', // Tipo da entidade
  processo.id, // ID da entidade
  usuario_id, // ID do usuário
  null, // Dados antigos (null para criação)
  { numero_sei: '123456', assunto: '...' }, // Dados novos
);
```

### Tipos de Ações Disponíveis

```typescript
enum TipoAcao {
  PROCESSO_CRIADO
  PROCESSO_ATUALIZADO
  PROCESSO_REMOVIDO
  ANDAMENTO_CRIADO
  ANDAMENTO_ATUALIZADO
  ANDAMENTO_PRORROGADO
  ANDAMENTO_CONCLUIDO
  ANDAMENTO_REMOVIDO
}
```

## 🌐 Endpoints REST

### Listar Todos os Logs

```
GET /logs?pagina=1&limite=10
```

**Filtros opcionais:**

- `tipoAcao`: Filtrar por tipo de ação
- `entidadeTipo`: Filtrar por tipo de entidade
- `entidadeId`: Filtrar por ID da entidade
- `usuario_id`: Filtrar por usuário
- `dataInicio`: Filtrar por data inicial (formato: DD-MM-YYYY)
- `dataFim`: Filtrar por data final (formato: DD-MM-YYYY)

**Permissões:** DEV, ADM

### Buscar Log por ID

```
GET /logs/:id
```

**Permissões:** DEV, ADM

### Buscar Logs de uma Entidade

```
GET /logs/entidade/:tipo/:id?pagina=1&limite=10
```

Exemplo: `GET /logs/entidade/processo/abc-123-def`

**Permissões:** DEV, ADM, TEC

### Buscar Logs de um Usuário

```
GET /logs/usuario/:id?pagina=1&limite=10
```

**Permissões:** DEV, ADM

### Buscar Logs por Tipo de Ação

```
GET /logs/tipo/:tipo?pagina=1&limite=10
```

Exemplo: `GET /logs/tipo/PROCESSO_CRIADO`

**Permissões:** DEV, ADM

## 🗄️ Estrutura do Banco de Dados

```prisma
model Log {
  id           String   @id @default(uuid())
  tipoAcao     TipoAcao
  descricao    String   @db.Text
  entidadeTipo String
  entidadeId   String
  dadosAntigos String?  @db.Text  // JSON com estado anterior
  dadosNovos   String?  @db.Text  // JSON com novo estado
  criadoEm     DateTime @default(now())
  usuario_id   String
  usuario      Usuario  @relation(fields: [usuario_id], references: [id])

  @@index([usuario_id])
  @@index([entidadeTipo, entidadeId])
  @@index([tipoAcao])
  @@index([criadoEm])
}
```

## ⚙️ Integração com Outros Módulos

O módulo de logs já está integrado em:

- ✅ **ProcessosModule**: Registra criação, atualização e remoção de processos
- ✅ **AndamentosModule**: Registra criação, atualização, prorrogação e conclusão de andamentos
- ✅ **AppModule**: Importado globalmente

## 🔒 Segurança

- Sistema resiliente: Erros no log não interrompem operações principais
- Dados sensíveis são armazenados em JSON para auditoria completa
- Acesso aos logs restrito a usuários com permissões adequadas

## 📊 Performance

- Índices otimizados para consultas frequentes
- Paginação obrigatória para grandes volumes
- Consultas eficientes por tipo, entidade e usuário

## 🚀 Próximos Passos

Para estender o módulo de logs, considere:

1. Adicionar mais tipos de ação conforme necessário
2. Implementar exportação de logs (CSV, PDF)
3. Adicionar dashboard de auditoria
4. Implementar retenção automática de logs antigos
5. Adicionar notificações para ações críticas

---

**Documentação criada em:** 19/11/2025  
**Versão:** 1.0.0
