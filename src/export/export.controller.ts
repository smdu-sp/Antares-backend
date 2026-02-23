import {
  Controller,
  Post,
  Body,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { ExportParamsDto } from './dto/export-params.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('processos/excel')
  async exportProcessosExcel(
    @Body() params: ExportParamsDto,
    @Res() res: Response,
    @UsuarioAtual('id') usuario_id: string,
  ) {
    try {
      const processos = await this.buscarProcessos(params, usuario_id);

      if (processos.length === 0) {
        throw new HttpException(
          'Nenhum processo encontrado com os filtros aplicados',
          HttpStatus.NOT_FOUND,
        );
      }

      const buffer = await this.exportService.exportProcessosToExcel(
        processos,
        params.incluirAndamentos,
        params.incluirProcesso,
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=processos-${Date.now()}.xlsx`,
      );
      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao exportar processos para Excel',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('processos/pdf')
  async exportProcessosPDF(
    @Body() params: ExportParamsDto,
    @Res() res: Response,
    @UsuarioAtual('id') usuario_id: string,
  ) {
    try {
      const processos = await this.buscarProcessos(params, usuario_id);

      if (processos.length === 0) {
        throw new HttpException(
          'Nenhum processo encontrado com os filtros aplicados',
          HttpStatus.NOT_FOUND,
        );
      }

      const buffer = await this.exportService.exportProcessosToPDF(
        processos,
        params.incluirAndamentos,
        params.incluirProcesso,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=processos-${Date.now()}.pdf`,
      );
      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao exportar processos para PDF',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('andamentos/excel')
  async exportAndamentosExcel(
    @Body() params: ExportParamsDto,
    @Res() res: Response,
    @UsuarioAtual('id') usuario_id: string,
  ) {
    try {
      const andamentos = await this.buscarAndamentos(params, usuario_id);

      if (andamentos.length === 0) {
        throw new HttpException(
          'Nenhum andamento encontrado com os filtros aplicados',
          HttpStatus.NOT_FOUND,
        );
      }

      const buffer =
        await this.exportService.exportAndamentosToExcel(andamentos);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=andamentos-${Date.now()}.xlsx`,
      );
      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao exportar andamentos para Excel',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('andamentos/pdf')
  async exportAndamentosPDF(
    @Body() params: ExportParamsDto,
    @Res() res: Response,
    @UsuarioAtual('id') usuario_id: string,
  ) {
    try {
      const andamentos = await this.buscarAndamentos(params, usuario_id);

      if (andamentos.length === 0) {
        throw new HttpException(
          'Nenhum andamento encontrado com os filtros aplicados',
          HttpStatus.NOT_FOUND,
        );
      }

      const buffer = await this.exportService.exportAndamentosToPDF(andamentos);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=andamentos-${Date.now()}.pdf`,
      );
      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao exportar andamentos para PDF',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Busca processos com base nos parâmetros de exportação
   */
  private async buscarProcessos(params: ExportParamsDto, usuario_id: string) {
    const where: any = {
      ativo: true,
    };

    // Filtro por IDs específicos
    if (params.ids && params.ids.length > 0) {
      where.id = { in: params.ids };
    }

    // Filtro por busca textual
    if (params.busca) {
      where.OR = [
        { numero_sei: { contains: params.busca } },
        { assunto: { contains: params.busca } },
        { origem: { contains: params.busca } },
      ];
    }

    // Filtro por interessado
    if (params.interessado) {
      where.interessado = {
        valor: { contains: params.interessado },
      };
    }

    // Filtro por unidade remetente
    if (params.unidadeRemetente) {
      where.unidade_remetente_id = params.unidadeRemetente;
    }

    // Filtro por unidade destino
    if (params.unidadeDestino) {
      where.unidade_destino_id = params.unidadeDestino;
    }

    // Filtro por processos vencendo hoje
    if (params.vencendoHoje) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            {
              prazo: {
                gte: hoje,
                lt: amanha,
              },
            },
            {
              prorrogacao: {
                gte: hoje,
                lt: amanha,
              },
            },
            {
              andamentos: {
                some: {
                  OR: [
                    {
                      prazo: {
                        gte: hoje,
                        lt: amanha,
                      },
                    },
                    {
                      prorrogacao: {
                        gte: hoje,
                        lt: amanha,
                      },
                    },
                  ],
                  resposta: null,
                },
              },
            },
          ],
        },
        {
          NOT: {
            andamentos: {
              some: {
                resposta: { not: null },
                destino: 'SMUL',
              },
            },
          },
        },
      ];
    }

    // Filtro por processos atrasados
    if (params.atrasados) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { prazo: { lt: hoje } },
            { prorrogacao: { lt: hoje } },
            {
              andamentos: {
                some: {
                  OR: [{ prazo: { lt: hoje } }, { prorrogacao: { lt: hoje } }],
                  resposta: null,
                },
              },
            },
          ],
        },
        {
          NOT: {
            andamentos: {
              some: {
                resposta: { not: null },
                destino: 'SMUL',
              },
            },
          },
        },
      ];
    }

    // Filtro por processos concluídos
    if (params.concluidos !== undefined) {
      if (params.concluidos) {
        where.andamentos = {
          some: {
            resposta: { not: null },
            destino: 'SMUL',
          },
        };
      } else {
        where.NOT = {
          andamentos: {
            some: {
              resposta: { not: null },
              destino: 'SMUL',
            },
          },
        };
      }
    }

    return await this.prisma.processo.findMany({
      where,
      include: {
        interessado: true,
        unidadeRemetente: true,
        unidadeDestino: true,
        andamentos: params.incluirAndamentos || params.incluirProcesso === false
          ? {
              orderBy: { criadoEm: 'asc' },
            }
          : false,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  /**
   * Busca andamentos com base nos parâmetros de exportação
   */
  private async buscarAndamentos(params: ExportParamsDto, usuario_id: string) {
    const where: any = {
      ativo: true,
    };

    // Filtro por IDs específicos
    if (params.ids && params.ids.length > 0) {
      where.id = { in: params.ids };
    }

    // Filtro por busca textual
    if (params.busca) {
      where.OR = [
        { origem: { contains: params.busca } },
        { destino: { contains: params.busca } },
        { assunto: { contains: params.busca } },
        { observacao: { contains: params.busca } },
        { processo: { numero_sei: { contains: params.busca } } },
      ];
    }

    // Filtro por processos vencendo hoje
    if (params.vencendoHoje) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            {
              prazo: {
                gte: hoje,
                lt: amanha,
              },
            },
            {
              prorrogacao: {
                gte: hoje,
                lt: amanha,
              },
            },
          ],
        },
        { resposta: null },
      ];
    }

    // Filtro por andamentos atrasados
    if (params.atrasados) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      where.AND = [
        ...(where.AND || []),
        {
          OR: [{ prazo: { lt: hoje } }, { prorrogacao: { lt: hoje } }],
        },
        { resposta: null },
      ];
    }

    // Filtro por andamentos concluídos
    if (params.concluidos !== undefined) {
      if (params.concluidos) {
        where.resposta = { not: null };
      } else {
        where.resposta = null;
      }
    }

    return await this.prisma.andamento.findMany({
      where,
      include: {
        processo: {
          select: {
            numero_sei: true,
            assunto: true,
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
