# Resumo de Alterações no Backend - Campos Origem e Resposta Final

## 📋 Visão Geral

Duas mudanças principais foram implementadas no frontend que requerem ajustes no backend:

1. **Campo "Origem" movido para Processo** (antes estava em Andamento)
2. **Campo "Unidade Respondida" automatizado na Resposta Final** (sempre usa a origem do processo)

---

## 🔄 Mudança 1: Campo "Origem" no Processo

### Schema Prisma

```prisma
model Processo {
  id               String      @id @default(uuid())
  numero_sei       String      @unique
  assunto          String      @db.Text
  origem           String      // ✨ NOVO CAMPO
  data_recebimento DateTime?
  criadoEm         DateTime    @default(now())
  atualizadoEm     DateTime    @updatedAt
  andamentos       Andamento[]
}
```

### DTOs

**CreateProcessoDto:**

```typescript
export class CreateProcessoDto {
  @IsString()
  @IsNotEmpty()
  numero_sei: string;

  @IsString()
  @IsNotEmpty()
  assunto: string;

  @IsString()
  @IsNotEmpty()
  origem: string; // ✨ OBRIGATÓRIO

  @IsOptional()
  @IsString()
  data_recebimento?: string;
}
```

**UpdateProcessoDto:**

```typescript
export class UpdateProcessoDto {
  @IsOptional()
  @IsString()
  numero_sei?: string;

  @IsOptional()
  @IsString()
  assunto?: string;

  @IsOptional()
  @IsString()
  origem?: string; // ✨ OPCIONAL

  @IsOptional()
  @IsString()
  data_recebimento?: string;
}
```

### Migration

```bash
npx prisma migrate dev --name add_origem_to_processo
```

**Importante:** Processos existentes precisarão de um valor padrão para `origem`:

```sql
-- Opção 1: Adicionar com valor padrão
ALTER TABLE `Processo` ADD COLUMN `origem` VARCHAR(191) NOT NULL DEFAULT 'EXPEDIENTE';

-- Opção 2: Permitir NULL temporariamente (não recomendado)
ALTER TABLE `Processo` ADD COLUMN `origem` VARCHAR(191) NULL;
```

---

## 🎯 Mudança 2: Unidade Respondida Automatizada

### Comportamento Atual

- **Antes:** Usuário selecionava manualmente a unidade respondida no formulário de resposta final
- **Agora:** Campo "Unidade Respondida" é automaticamente preenchido com `processo.origem` (não editável)

### O que o Frontend Envia

```typescript
// Dados enviados para POST /processos/resposta-final
{
  processo_id: "uuid-do-processo",
  data_resposta_final: "2025-11-28T00:00:00.000Z",
  resposta: "Texto da resposta final...",
  unidade_respondida_id: "EXPEDIENTE" // ✅ Sempre será processo.origem
}
```

### Validação Recomendada no Backend

**Opção 1 - Validar consistência (Recomendado):**

```typescript
async criarRespostaFinal(dto: CreateRespostaFinalDto) {
  const processo = await this.prisma.processo.findUnique({
    where: { id: dto.processo_id },
    select: { origem: true }
  });

  // Validar que unidade_respondida_id corresponde à origem do processo
  if (dto.unidade_respondida_id !== processo.origem) {
    throw new BadRequestException(
      'A unidade respondida deve ser a unidade de origem do processo'
    );
  }

  // ... criar resposta final
}
```

**Opção 2 - Ignorar campo enviado e usar sempre a origem (Mais seguro):**

```typescript
async criarRespostaFinal(dto: CreateRespostaFinalDto) {
  const processo = await this.prisma.processo.findUnique({
    where: { id: dto.processo_id },
    select: { origem: true }
  });

  // Sempre usa a origem do processo, ignorando o que vem no DTO
  return await this.prisma.respostaFinal.create({
    data: {
      processo_id: dto.processo_id,
      data_resposta_final: new Date(dto.data_resposta_final),
      resposta: dto.resposta,
      unidade_respondida_id: processo.origem, // ✅ Força uso da origem
    },
  });
}
```

---

## 📊 Impacto nos Endpoints

### Endpoints Afetados

| Endpoint                    | Método | Mudança                                                       |
| --------------------------- | ------ | ------------------------------------------------------------- |
| `/processos`                | POST   | Adicionar campo `origem` obrigatório no body                  |
| `/processos/:id`            | PATCH  | Adicionar campo `origem` opcional no body                     |
| `/processos`                | GET    | Incluir campo `origem` na resposta                            |
| `/processos/:id`            | GET    | Incluir campo `origem` na resposta                            |
| `/processos/resposta-final` | POST   | `unidade_respondida_id` sempre será igual a `processo.origem` |

---

## ✅ Checklist de Implementação

### Mudança 1: Campo Origem

- [ ] Atualizar schema Prisma com campo `origem` em Processo
- [ ] Criar migration com valor padrão para registros existentes
- [ ] Atualizar CreateProcessoDto (campo obrigatório)
- [ ] Atualizar UpdateProcessoDto (campo opcional)
- [ ] Atualizar service de criação de processo
- [ ] Atualizar service de atualização de processo
- [ ] Incluir campo `origem` em todas as queries de listagem
- [ ] Testar criação de processo sem campo `origem` (deve retornar erro)
- [ ] Testar criação de andamento (deve usar `processo.origem` automaticamente no frontend)

### Mudança 2: Resposta Final

- [ ] Decidir estratégia: validar consistência ou forçar uso de `processo.origem`
- [ ] Implementar lógica escolhida no service de resposta final
- [ ] Adicionar teste para verificar que `unidade_respondida_id` corresponde à origem
- [ ] Documentar comportamento na API (Swagger/OpenAPI)

---

## 🧪 Casos de Teste

### Processo com Campo Origem

```typescript
// ✅ Deve criar processo com sucesso
POST /processos
{
  "numero_sei": "1234567",
  "assunto": "Teste de processo",
  "origem": "EXPEDIENTE",
  "data_recebimento": "2025-11-28T00:00:00.000Z"
}

// ❌ Deve retornar erro 400
POST /processos
{
  "numero_sei": "1234567",
  "assunto": "Teste de processo",
  // origem ausente
  "data_recebimento": "2025-11-28T00:00:00.000Z"
}
```

### Resposta Final com Origem

```typescript
// Setup
const processo = await criarProcesso({
  numero_sei: "1234567",
  assunto: "Teste",
  origem: "EXPEDIENTE"
});

// ✅ Deve criar resposta final (origem correta)
POST /processos/resposta-final
{
  "processo_id": processo.id,
  "data_resposta_final": "2025-11-28T00:00:00.000Z",
  "resposta": "Resposta ao solicitante...",
  "unidade_respondida_id": "EXPEDIENTE" // Igual à origem
}

// Se escolher Opção 1 (validar):
// ❌ Deve retornar erro 400 (origem diferente)
POST /processos/resposta-final
{
  "processo_id": processo.id,
  "data_resposta_final": "2025-11-28T00:00:00.000Z",
  "resposta": "Resposta ao solicitante...",
  "unidade_respondida_id": "OUTRA_UNIDADE" // Diferente da origem
}

// Se escolher Opção 2 (forçar origem):
// ✅ Deve criar resposta final ignorando campo enviado e usando origem
POST /processos/resposta-final
{
  "processo_id": processo.id,
  "data_resposta_final": "2025-11-28T00:00:00.000Z",
  "resposta": "Resposta ao solicitante...",
  "unidade_respondida_id": "QUALQUER_COISA" // Será ignorado e substituído por processo.origem
}
```

---

## 💡 Recomendações

1. **Use a Opção 2** (forçar `processo.origem`) para resposta final - é mais segura e evita inconsistências
2. **Valor padrão para origem**: Use "EXPEDIENTE" ou outro valor que faça sentido para processos antigos
3. **Documentação**: Atualize a documentação da API (Swagger) para refletir as mudanças
4. **Testes**: Adicione testes unitários e de integração para os novos comportamentos
5. **Versionamento**: Considere versionar a API se houver breaking changes

---

## 📞 Dúvidas Frequentes

**Q: O que acontece com andamentos já criados?**  
A: O campo `origem` em `Andamento` continua existindo e funcionando normalmente. A mudança apenas move a responsabilidade de definir a origem para o momento de criação do processo.

**Q: Posso atualizar a origem de um processo depois de criado?**  
A: Sim, o campo `origem` é opcional no UpdateProcessoDto, permitindo atualizações.

**Q: O que fazer com processos antigos sem campo origem?**  
A: No migration, defina um valor padrão (ex: "EXPEDIENTE") ou permita NULL temporariamente e faça uma migração de dados posterior.

**Q: Preciso alterar a tabela de Andamentos?**  
A: Não. O campo `origem` continua em `Andamento`, mas agora será preenchido automaticamente com `processo.origem` pelo frontend.
