# Módulo de Exportação

Este módulo fornece funcionalidades para exportar dados de processos e andamentos em formatos PDF e Excel.

## Endpoints Disponíveis

### 1. Exportar Processos para Excel

**POST** `/export/processos/excel`

Exporta processos em formato Excel (.xlsx) com suporte a filtros.

### 2. Exportar Processos para PDF

**POST** `/export/processos/pdf`

Exporta processos em formato PDF com todos os detalhes.

### 3. Exportar Andamentos para Excel

**POST** `/export/andamentos/excel`

Exporta andamentos em formato Excel (.xlsx) com suporte a filtros.

### 4. Exportar Andamentos para PDF

**POST** `/export/andamentos/pdf`

Exporta andamentos em formato PDF com todos os detalhes.

## Parâmetros de Filtro (ExportParamsDto)

Todos os endpoints aceitam os seguintes parâmetros no body da requisição:

```typescript
{
  // IDs específicos para exportar (opcional)
  ids?: string[];

  // Busca textual (opcional)
  // Para processos: busca em numero_sei, assunto, origem
  // Para andamentos: busca em origem, destino, assunto, observacao, numero_sei do processo
  busca?: string;

  // Filtros específicos para processos
  interessado?: string;              // Filtra por interessado
  unidadeRemetente?: string;          // ID da unidade remetente
  unidadeDestino?: string;            // ID da unidade destino

  // Filtros rápidos
  vencendoHoje?: boolean;            // Processos/andamentos vencendo hoje
  atrasados?: boolean;               // Processos/andamentos atrasados
  concluidos?: boolean;              // Processos/andamentos concluídos

  // Opções de exportação
  incluirAndamentos?: boolean;       // Incluir andamentos na exportação de processos
}
```

## Exemplos de Uso

### 1. Exportar Todos os Processos para Excel

```bash
curl -X POST http://localhost:3000/export/processos/excel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --output processos.xlsx
```

### 2. Exportar Processos Específicos para PDF (com andamentos)

```bash
curl -X POST http://localhost:3000/export/processos/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["processo-id-1", "processo-id-2"],
    "incluirAndamentos": true
  }' \
  --output processos.pdf
```

### 3. Exportar Processos Atrasados para Excel

```bash
curl -X POST http://localhost:3000/export/processos/excel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "atrasados": true
  }' \
  --output processos_atrasados.xlsx
```

### 4. Exportar Andamentos com Busca Textual

```bash
curl -X POST http://localhost:3000/export/andamentos/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "busca": "SMUL"
  }' \
  --output andamentos.pdf
```

### 5. Exportar Processos de uma Unidade Específica

```bash
curl -X POST http://localhost:3000/export/processos/excel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unidadeRemetente": "unidade-id-123"
  }' \
  --output processos_unidade.xlsx
```

### 6. Exportar Processos Vencendo Hoje

```bash
curl -X POST http://localhost:3000/export/processos/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vencendoHoje": true,
    "incluirAndamentos": true
  }' \
  --output vencendo_hoje.pdf
```

## Integração no Frontend

### Exemplo com Axios (TypeScript/JavaScript)

```typescript
import axios from 'axios';

// Função para baixar arquivo
const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Exportar processos para Excel
const exportProcessosExcel = async (filtros: ExportParamsDto) => {
  try {
    const response = await axios.post('/export/processos/excel', filtros, {
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    downloadFile(response.data, `processos_${Date.now()}.xlsx`);
  } catch (error) {
    console.error('Erro ao exportar:', error);
  }
};

// Exportar processos para PDF
const exportProcessosPDF = async (filtros: ExportParamsDto) => {
  try {
    const response = await axios.post('/export/processos/pdf', filtros, {
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    downloadFile(response.data, `processos_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar:', error);
  }
};

// Usar as funções
exportProcessosExcel({ atrasados: true });
exportProcessosPDF({ ids: ['id1', 'id2'], incluirAndamentos: true });
```

### Exemplo com Fetch

```typescript
const exportar = async (
  tipo: 'excel' | 'pdf',
  entidade: 'processos' | 'andamentos',
  filtros: ExportParamsDto,
) => {
  const response = await fetch(`/export/${entidade}/${tipo}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(filtros),
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar');
  }

  const blob = await response.blob();
  const extension = tipo === 'excel' ? 'xlsx' : 'pdf';
  downloadFile(blob, `${entidade}_${Date.now()}.${extension}`);
};

// Usar a função
exportar('excel', 'processos', { vencendoHoje: true });
exportar('pdf', 'andamentos', { concluidos: false });
```

## Formato dos Arquivos Exportados

### Excel - Processos

Colunas:

- Número SEI
- Assunto
- Origem
- Interessado
- Unidade Remetente
- Unidade Destino
- Data Recebimento
- Data Envio
- Prazo
- Prorrogação
- Data Resposta Final
- Resposta Final
- Criado Em

Se `incluirAndamentos: true`, cada processo com andamentos terá uma planilha adicional com seus andamentos.

### Excel - Andamentos

Colunas:

- Número SEI (do processo)
- Origem
- Destino
- Assunto
- Data Envio
- Prazo
- Prorrogação
- Resposta
- Status
- Observação
- Criado Em

### PDF - Processos

Formato de relatório com todos os detalhes de cada processo, incluindo andamentos se `incluirAndamentos: true`.

### PDF - Andamentos

Formato de relatório com todos os detalhes de cada andamento, incluindo o número SEI do processo relacionado.

## Notas Importantes

1. **Autenticação**: Todos os endpoints requerem autenticação JWT
2. **Permissões**: O usuário precisa ter permissão para visualizar os processos/andamentos
3. **Performance**: A exportação de grandes volumes de dados pode levar alguns segundos
4. **Limite**: Recomenda-se não exportar mais de 1000 registros de uma vez
5. **Formato de Datas**: Todas as datas são formatadas como `dd/MM/yyyy HH:mm`
6. **Encoding**: Os arquivos Excel usam UTF-8 para suportar caracteres especiais
7. **Tratamento de Erros**:
   - 404: Nenhum registro encontrado com os filtros aplicados
   - 500: Erro interno ao gerar o arquivo

## Bibliotecas Utilizadas

- **ExcelJS**: Geração de arquivos Excel (.xlsx)
- **PDFKit**: Geração de arquivos PDF
- **date-fns**: Formatação de datas em português
