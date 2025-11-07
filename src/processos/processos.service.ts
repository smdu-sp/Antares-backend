import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProcessoDto } from './dto/create-processo.dto';
import { UpdateProcessoDto } from './dto/update-processo.dto';
import { ProcessoResponseDto, ProcessoPaginadoResponseDto } from './dto/processo-response.dto';
import { processo, $Enums } from '@prisma/client';
import { AppService } from 'src/app.service';

/**
 * Service - Camada de Lógica de Negócio
 * 
 * O Service é responsável por:
 * 1. Implementar a lógica de negócio (regras de negócio)
 * 2. Interagir com o banco de dados através do PrismaService
 * 3. Validar dados antes de salvar
 * 4. Tratar erros e exceções
 * 5. Retornar dados formatados para o Controller
 * 
 * O Service NÃO conhece HTTP, rotas ou requisições.
 * Ele apenas processa dados e retorna resultados.
 */
@Injectable()
export class ProcessosService {
  constructor(
    private prisma: PrismaService, // Injeção de dependência do Prisma
    private app: AppService,      // Serviço auxiliar para paginação
  ) {}

  /**
   * Cria um novo processo
   * 
   * @param createProcessoDto - Dados do processo a ser criado
   * @returns Processo criado
   */
  async criar(createProcessoDto: CreateProcessoDto): Promise<ProcessoResponseDto> {
    // Verifica se já existe um processo com o mesmo número SEI
    const processoExistente = await this.prisma.processo.findUnique({
      where: { numero_sei: createProcessoDto.numero_sei },
    });

    if (processoExistente) {
      throw new BadRequestException('Já existe um processo com este número SEI.');
    }

    // Cria o processo no banco de dados
    const processo: processo = await this.prisma.processo.create({
      data: {
        numero_sei: createProcessoDto.numero_sei,
        assunto: createProcessoDto.assunto,
      },
    });

    if (!processo) {
      throw new InternalServerErrorException('Não foi possível criar o processo.');
    }

    return processo;
  }

  /**
   * Busca todos os processos com paginação
   * 
   * @param pagina - Número da página (padrão: 1)
   * @param limite - Itens por página (padrão: 10)
   * @param busca - Termo de busca (opcional)
   * @returns Lista paginada de processos
   */
  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    vencendoHoje: boolean = false,
    atrasados: boolean = false,
  ): Promise<ProcessoPaginadoResponseDto> {
    // Valida e ajusta página e limite usando o AppService
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    // Calcula início e fim do dia atual (00:00:00 até 23:59:59)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);

    // Monta os filtros de busca
    const searchParams: any = {
      ...(busca && {
        OR: [
          { numero_sei: { contains: busca } },
          { assunto: { contains: busca } },
        ],
      }),
      ...(vencendoHoje && {
        andamentos: {
          some: {
            OR: [
              // Prazo original vencendo hoje (sem prorrogação)
              {
                prazo: {
                  gte: hoje,
                  lte: fimDoDia,
                },
                prorrogacao: null,
                status: {
                  not: $Enums.StatusAndamento.CONCLUIDO,
                },
              },
              // Prorrogação vencendo hoje
              {
                prorrogacao: {
                  gte: hoje,
                  lte: fimDoDia,
                },
                status: {
                  not: $Enums.StatusAndamento.CONCLUIDO,
                },
              },
            ],
          },
        },
      }),
      ...(atrasados && {
        andamentos: {
          some: {
            OR: [
              // Prazo original já venceu (sem prorrogação)
              {
                prazo: {
                  lt: hoje,
                },
                prorrogacao: null,
                status: {
                  not: $Enums.StatusAndamento.CONCLUIDO,
                },
              },
              // Prorrogação já venceu
              {
                prorrogacao: {
                  lt: hoje,
                },
                status: {
                  not: $Enums.StatusAndamento.CONCLUIDO,
                },
              },
            ],
          },
        },
      }),
    };

    // Conta o total de processos que atendem aos filtros
    const total: number = await this.prisma.processo.count({
      where: searchParams,
    });

    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    // Ajusta página e limite baseado no total
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    // Busca os processos com paginação
    const processos: processo[] = await this.prisma.processo.findMany({
      where: searchParams,
      orderBy: { criadoEm: 'desc' }, // Mais recentes primeiro
      skip: (pagina - 1) * limite,    // Pula os registros das páginas anteriores
      take: limite,                   // Limita a quantidade de resultados
      include: {
        andamentos: {
          orderBy: { criadoEm: 'desc' }, // Andamentos mais recentes primeiro
        },
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: processos,
    };
  }

  /**
   * Busca um processo por ID
   * 
   * @param id - ID do processo
   * @returns Processo encontrado
   */
  async buscarPorId(id: string): Promise<ProcessoResponseDto> {
    if (!id || id === '') {
      throw new BadRequestException('ID do processo é obrigatório.');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id },
      include: {
        andamentos: {
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    return processo;
  }

  /**
   * Busca um processo por número SEI
   * 
   * @param numero_sei - Número SEI do processo
   * @returns Processo encontrado
   */
  async buscarPorNumeroSei(numero_sei: string): Promise<ProcessoResponseDto> {
    if (!numero_sei || numero_sei === '') {
      throw new BadRequestException('Número SEI é obrigatório.');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { numero_sei },
      include: {
        andamentos: {
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    return processo;
  }

  /**
   * Atualiza um processo
   * 
   * @param id - ID do processo a ser atualizado
   * @param updateProcessoDto - Dados a serem atualizados
   * @returns Processo atualizado
   */
  async atualizar(
    id: string,
    updateProcessoDto: UpdateProcessoDto,
  ): Promise<ProcessoResponseDto> {
    // Verifica se o processo existe
    const processoExistente = await this.buscarPorId(id);

    // Se está tentando atualizar o número SEI, verifica se não existe outro com o mesmo número
    if (updateProcessoDto.numero_sei && updateProcessoDto.numero_sei !== processoExistente.numero_sei) {
      const processoComMesmoSei = await this.prisma.processo.findUnique({
        where: { numero_sei: updateProcessoDto.numero_sei },
      });

      if (processoComMesmoSei) {
        throw new BadRequestException('Já existe outro processo com este número SEI.');
      }
    }

    // Atualiza o processo
    const processoAtualizado = await this.prisma.processo.update({
      where: { id },
      data: updateProcessoDto,
      include: {
        andamentos: {
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    return processoAtualizado;
  }

  /**
   * Remove um processo (soft delete - apenas marca como removido)
   * 
   * @param id - ID do processo a ser removido
   * @returns Confirmação de remoção
   */
  async remover(id: string): Promise<{ removido: boolean }> {
    // Verifica se o processo existe
    await this.buscarPorId(id);

    // Remove o processo (hard delete - remove do banco)
    // Se quiser soft delete, você pode adicionar um campo "deletado" no schema
    await this.prisma.processo.delete({
      where: { id },
    });

    return { removido: true };
  }
}

