import { Injectable } from '@nestjs/common';
import { processo, andamento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

@Injectable()
export class ExportService {
  /**
   * Exporta processos para Excel
   */
  async exportProcessosToExcel(
    processos: any[],
    incluirAndamentos: boolean = false,
    incluirProcesso: boolean = true,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Se incluirProcesso === false, exporta apenas andamentos
    if (incluirProcesso === false) {
      const todosAndamentos = processos.flatMap((p) =>
        (p.andamentos || []).map((a) => ({
          ...a,
          processo: { numero_sei: p.numero_sei, assunto: p.assunto },
        })),
      );
      return this.exportAndamentosToExcel(todosAndamentos);
    }

    const worksheet = workbook.addWorksheet('Processos');

    // Define colunas
    worksheet.columns = [
      { header: 'Número SEI', key: 'numero_sei', width: 20 },
      { header: 'Assunto', key: 'assunto', width: 40 },
      { header: 'Origem', key: 'origem', width: 20 },
      { header: 'Interessado', key: 'interessado', width: 30 },
      { header: 'Unidade Remetente', key: 'unidadeRemetente', width: 25 },
      { header: 'Unidade Destino', key: 'unidadeDestino', width: 25 },
      { header: 'Data Recebimento', key: 'data_recebimento', width: 18 },
      { header: 'Data Envio', key: 'data_envio_unidade', width: 18 },
      { header: 'Prazo', key: 'prazo', width: 18 },
      { header: 'Prorrogação', key: 'prorrogacao', width: 18 },
      { header: 'Data Resposta Final', key: 'data_resposta_final', width: 18 },
      { header: 'Resposta Final', key: 'resposta_final', width: 40 },
      { header: 'Criado Em', key: 'criadoEm', width: 18 },
    ];

    // Estilo do cabeçalho
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Adiciona dados
    processos.forEach((processo) => {
      const row: any = {
        numero_sei: processo.numero_sei,
        assunto: processo.assunto,
        origem: processo.origem,
        interessado: processo.interessado?.valor || '',
        unidadeRemetente: processo.unidadeRemetente
          ? `${processo.unidadeRemetente.sigla} - ${processo.unidadeRemetente.nome}`
          : '',
        unidadeDestino: processo.unidadeDestino
          ? `${processo.unidadeDestino.sigla} - ${processo.unidadeDestino.nome}`
          : '',
        data_recebimento: processo.data_recebimento
          ? this.formatDate(processo.data_recebimento)
          : '',
        data_envio_unidade: processo.data_envio_unidade
          ? this.formatDate(processo.data_envio_unidade)
          : '',
        prazo: processo.prazo ? this.formatDate(processo.prazo) : '',
        prorrogacao: processo.prorrogacao
          ? this.formatDate(processo.prorrogacao)
          : '',
        data_resposta_final: processo.data_resposta_final
          ? this.formatDate(processo.data_resposta_final)
          : '',
        resposta_final: processo.resposta_final || '',
        criadoEm: this.formatDate(processo.criadoEm),
      };

      worksheet.addRow(row);

      // Se incluir andamentos, adiciona planilha separada
      if (incluirAndamentos && processo.andamentos?.length > 0) {
        this.addAndamentosSheet(workbook, processo);
      }
    });

    // Auto-ajusta largura das colunas
    worksheet.columns.forEach((column) => {
      if (column && column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Adiciona planilha de andamentos para um processo
   */
  private addAndamentosSheet(workbook: ExcelJS.Workbook, processo: any) {
    // Sanitiza o nome da sheet removendo caracteres proibidos: * ? : \ / [ ]
    // Excel permite no máximo 31 caracteres. "Andamentos - " = 14 chars, sobram 17
    const sanitizedSei = processo.numero_sei
      .replace(/[*?:\\\/\[\]]/g, '-')
      .substring(0, 17);
    const sheetName = `Andamentos - ${sanitizedSei}`;
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = [
      { header: 'Origem', key: 'origem', width: 25 },
      { header: 'Destino', key: 'destino', width: 25 },
      { header: 'Assunto', key: 'assunto', width: 35 },
      { header: 'Data Envio', key: 'data_envio', width: 18 },
      { header: 'Prazo', key: 'prazo', width: 18 },
      { header: 'Prorrogação', key: 'prorrogacao', width: 18 },
      { header: 'Resposta', key: 'resposta', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Observação', key: 'observacao', width: 40 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '70AD47' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    processo.andamentos.forEach((andamento: any) => {
      worksheet.addRow({
        origem: andamento.origem,
        destino: andamento.destino,
        assunto: andamento.assunto || '',
        data_envio: andamento.data_envio
          ? this.formatDate(andamento.data_envio)
          : '',
        prazo: andamento.prazo ? this.formatDate(andamento.prazo) : '',
        prorrogacao: andamento.prorrogacao
          ? this.formatDate(andamento.prorrogacao)
          : '',
        resposta: andamento.resposta ? this.formatDate(andamento.resposta) : '',
        status: andamento.status,
        observacao: andamento.observacao || '',
      });
    });
  }

  /**
   * Exporta andamentos para Excel
   */
  async exportAndamentosToExcel(andamentos: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Andamentos');

    worksheet.columns = [
      { header: 'Número SEI', key: 'numero_sei', width: 20 },
      { header: 'Origem', key: 'origem', width: 25 },
      { header: 'Destino', key: 'destino', width: 25 },
      { header: 'Assunto', key: 'assunto', width: 35 },
      { header: 'Data Envio', key: 'data_envio', width: 18 },
      { header: 'Prazo', key: 'prazo', width: 18 },
      { header: 'Prorrogação', key: 'prorrogacao', width: 18 },
      { header: 'Resposta', key: 'resposta', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Observação', key: 'observacao', width: 40 },
      { header: 'Criado Em', key: 'criadoEm', width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '70AD47' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    andamentos.forEach((andamento) => {
      worksheet.addRow({
        numero_sei: andamento.processo?.numero_sei || '',
        origem: andamento.origem,
        destino: andamento.destino,
        assunto: andamento.assunto || '',
        data_envio: andamento.data_envio
          ? this.formatDate(andamento.data_envio)
          : '',
        prazo: andamento.prazo ? this.formatDate(andamento.prazo) : '',
        prorrogacao: andamento.prorrogacao
          ? this.formatDate(andamento.prorrogacao)
          : '',
        resposta: andamento.resposta ? this.formatDate(andamento.resposta) : '',
        status: andamento.status,
        observacao: andamento.observacao || '',
        criadoEm: this.formatDate(andamento.criadoEm),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporta processos para PDF
   */
  async exportProcessosToPDF(
    processos: any[],
    incluirAndamentos: boolean = false,
    incluirProcesso: boolean = true,
  ): Promise<Buffer> {
    // Se incluirProcesso === false, exporta apenas andamentos
    if (incluirProcesso === false) {
      const todosAndamentos = processos.flatMap((p) =>
        (p.andamentos || []).map((a) => ({
          ...a,
          processo: { numero_sei: p.numero_sei, assunto: p.assunto },
        })),
      );
      return this.exportAndamentosToPDF(todosAndamentos);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Título
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Relatório de Processos', { align: 'center' });
      doc.moveDown();

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Data de Geração: ${this.formatDate(new Date())}`, {
          align: 'center',
        });
      doc.moveDown(2);

      // Para cada processo
      processos.forEach((processo, index) => {
        if (index > 0) {
          doc.addPage();
        }

        this.addProcessoToPDF(doc, processo, incluirAndamentos);
      });

      doc.end();
    });
  }

  /**
   * Adiciona um processo ao PDF
   */
  private addProcessoToPDF(
    doc: typeof PDFDocument,
    processo: any,
    incluirAndamentos: boolean,
  ) {
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`Processo: ${processo.numero_sei}`);
    doc.moveDown(0.5);

    const details = [
      { label: 'Assunto', value: processo.assunto },
      { label: 'Origem', value: processo.origem },
      {
        label: 'Interessado',
        value: processo.interessado?.valor || 'Não informado',
      },
      {
        label: 'Unidade Remetente',
        value: processo.unidadeRemetente
          ? `${processo.unidadeRemetente.sigla} - ${processo.unidadeRemetente.nome}`
          : 'Não informada',
      },
      {
        label: 'Unidade Destino',
        value: processo.unidadeDestino
          ? `${processo.unidadeDestino.sigla} - ${processo.unidadeDestino.nome}`
          : 'Não informada',
      },
      {
        label: 'Data Recebimento',
        value: processo.data_recebimento
          ? this.formatDate(processo.data_recebimento)
          : 'Não informada',
      },
      {
        label: 'Data Envio',
        value: processo.data_envio_unidade
          ? this.formatDate(processo.data_envio_unidade)
          : 'Não informada',
      },
      {
        label: 'Prazo',
        value: processo.prazo
          ? this.formatDate(processo.prazo)
          : 'Não informado',
      },
      {
        label: 'Prorrogação',
        value: processo.prorrogacao
          ? this.formatDate(processo.prorrogacao)
          : 'Não informada',
      },
      {
        label: 'Data Resposta Final',
        value: processo.data_resposta_final
          ? this.formatDate(processo.data_resposta_final)
          : 'Não informada',
      },
      {
        label: 'Resposta Final',
        value: processo.resposta_final || 'Não informada',
      },
    ];

    doc.fontSize(10).font('Helvetica');
    details.forEach((detail) => {
      doc
        .font('Helvetica-Bold')
        .text(`${detail.label}: `, { continued: true })
        .font('Helvetica')
        .text(detail.value);
    });

    // Andamentos
    if (incluirAndamentos && processo.andamentos?.length > 0) {
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold').text('Andamentos:');
      doc.moveDown(0.5);

      processo.andamentos.forEach((andamento: any, index: number) => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`${index + 1}. Andamento:`);
        doc.fontSize(9).font('Helvetica');
        doc.text(`  Origem: ${andamento.origem}`);
        doc.text(`  Destino: ${andamento.destino}`);
        if (andamento.assunto) {
          doc.text(`  Assunto: ${andamento.assunto}`);
        }
        doc.text(`  Status: ${andamento.status}`);
        if (andamento.data_envio) {
          doc.text(`  Data Envio: ${this.formatDate(andamento.data_envio)}`);
        }
        if (andamento.prazo) {
          doc.text(`  Prazo: ${this.formatDate(andamento.prazo)}`);
        }
        if (andamento.prorrogacao) {
          doc.text(`  Prorrogação: ${this.formatDate(andamento.prorrogacao)}`);
        }
        if (andamento.resposta) {
          doc.text(`  Resposta: ${this.formatDate(andamento.resposta)}`);
        }
        if (andamento.observacao) {
          doc.text(`  Observação: ${andamento.observacao}`);
        }
        doc.moveDown(0.5);
      });
    }
  }

  /**
   * Exporta andamentos para PDF
   */
  async exportAndamentosToPDF(andamentos: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Título
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Relatório de Andamentos', { align: 'center' });
      doc.moveDown();

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Data de Geração: ${this.formatDate(new Date())}`, {
          align: 'center',
        });
      doc.moveDown(2);

      // Para cada andamento
      andamentos.forEach((andamento, index) => {
        if (index > 0 && index % 3 === 0) {
          doc.addPage();
        }

        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`Andamento ${index + 1}`);
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        doc
          .font('Helvetica-Bold')
          .text('Processo: ', { continued: true })
          .font('Helvetica')
          .text(andamento.processo?.numero_sei || 'Não identificado');

        doc
          .font('Helvetica-Bold')
          .text('Origem: ', { continued: true })
          .font('Helvetica')
          .text(andamento.origem);

        doc
          .font('Helvetica-Bold')
          .text('Destino: ', { continued: true })
          .font('Helvetica')
          .text(andamento.destino);

        if (andamento.assunto) {
          doc
            .font('Helvetica-Bold')
            .text('Assunto: ', { continued: true })
            .font('Helvetica')
            .text(andamento.assunto);
        }

        doc
          .font('Helvetica-Bold')
          .text('Status: ', { continued: true })
          .font('Helvetica')
          .text(andamento.status);

        if (andamento.data_envio) {
          doc
            .font('Helvetica-Bold')
            .text('Data Envio: ', { continued: true })
            .font('Helvetica')
            .text(this.formatDate(andamento.data_envio));
        }

        if (andamento.prazo) {
          doc
            .font('Helvetica-Bold')
            .text('Prazo: ', { continued: true })
            .font('Helvetica')
            .text(this.formatDate(andamento.prazo));
        }

        if (andamento.prorrogacao) {
          doc
            .font('Helvetica-Bold')
            .text('Prorrogação: ', { continued: true })
            .font('Helvetica')
            .text(this.formatDate(andamento.prorrogacao));
        }

        if (andamento.resposta) {
          doc
            .font('Helvetica-Bold')
            .text('Resposta: ', { continued: true })
            .font('Helvetica')
            .text(this.formatDate(andamento.resposta));
        }

        if (andamento.observacao) {
          doc
            .font('Helvetica-Bold')
            .text('Observação: ', { continued: true })
            .font('Helvetica')
            .text(andamento.observacao);
        }

        doc.moveDown(1.5);
      });

      doc.end();
    });
  }

  /**
   * Formata data para exibição
   */
  private formatDate(date: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  }
}
