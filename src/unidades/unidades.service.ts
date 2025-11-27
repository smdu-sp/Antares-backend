import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUnidadeDto } from './dto/create-unidade.dto';
import { UpdateUnidadeDto } from './dto/update-unidade.dto';
import {
  UnidadeResponseDto,
  UnidadePaginadoResponseDto,
} from './dto/unidade-response.dto';
import { Unidade } from '@prisma/client';
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
 */
@Injectable()
export class UnidadesService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  /**
   * Cria uma nova unidade
   *
   * @param createUnidadeDto - Dados da unidade a ser criada
   * @returns Unidade criada
   */
  async criar(createUnidadeDto: CreateUnidadeDto): Promise<UnidadeResponseDto> {
    // Verifica se já existe uma unidade com o mesmo nome
    const unidadeComMesmoNome = await this.prisma.unidade.findUnique({
      where: { nome: createUnidadeDto.nome },
    });

    if (unidadeComMesmoNome) {
      throw new BadRequestException('Já existe uma unidade com este nome.');
    }

    // Verifica se já existe uma unidade com a mesma sigla
    const unidadeComMesmaSigla = await this.prisma.unidade.findUnique({
      where: { sigla: createUnidadeDto.sigla.toUpperCase() },
    });

    if (unidadeComMesmaSigla) {
      throw new BadRequestException('Já existe uma unidade com esta sigla.');
    }

    // Cria a unidade no banco de dados
    const unidade: Unidade = await this.prisma.unidade.create({
      data: {
        nome: createUnidadeDto.nome,
        sigla: createUnidadeDto.sigla.toUpperCase(),
      },
    });

    if (!unidade) {
      throw new InternalServerErrorException(
        'Não foi possível criar a unidade.',
      );
    }

    return unidade;
  }

  /**
   * Busca todas as unidades com paginação
   *
   * @param pagina - Número da página (padrão: 1)
   * @param limite - Itens por página (padrão: 10)
   * @param busca - Termo de busca (opcional)
   * @returns Lista paginada de unidades
   */
  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
  ): Promise<UnidadePaginadoResponseDto> {
    // Valida e ajusta página e limite usando o AppService
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    // Monta os filtros de busca
    const searchParams: any = {
      ativo: true, // Apenas unidades ativas
      ...(busca && {
        OR: [
          { nome: { contains: busca } },
          { sigla: { contains: busca.toUpperCase() } },
        ],
      }),
    };

    // Conta o total de unidades que atendem aos filtros
    const total: number = await this.prisma.unidade.count({
      where: searchParams,
    });

    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    // Ajusta página e limite baseado no total
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    // Busca as unidades com paginação
    const unidades: Unidade[] = await this.prisma.unidade.findMany({
      where: searchParams,
      orderBy: { nome: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: unidades,
    };
  }

  /**
   * Busca todas as unidades (lista completa)
   *
   * @returns Lista completa de unidades
   */
  async listaCompleta(): Promise<UnidadeResponseDto[]> {
    const unidades: Unidade[] = await this.prisma.unidade.findMany({
      where: { ativo: true }, // Apenas unidades ativas
      orderBy: { nome: 'asc' },
    });

    return unidades;
  }

  /**
   * Busca uma unidade por ID
   *
   * @param id - ID da unidade
   * @returns Unidade encontrada
   */
  async buscarPorId(id: string): Promise<UnidadeResponseDto> {
    if (!id || id === '') {
      throw new BadRequestException('ID da unidade é obrigatório.');
    }

    const unidade = await this.prisma.unidade.findUnique({
      where: { id },
    });

    if (!unidade || !unidade.ativo) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    return unidade;
  }

  /**
   * Atualiza uma unidade
   *
   * @param id - ID da unidade a ser atualizada
   * @param updateUnidadeDto - Dados a serem atualizados
   * @returns Unidade atualizada
   */
  async atualizar(
    id: string,
    updateUnidadeDto: UpdateUnidadeDto,
  ): Promise<UnidadeResponseDto> {
    // Verifica se a unidade existe
    const unidadeExistente = await this.buscarPorId(id);

    // Se está tentando atualizar o nome, verifica se não existe outra com o mesmo nome
    if (
      updateUnidadeDto.nome &&
      updateUnidadeDto.nome !== unidadeExistente.nome
    ) {
      const unidadeComMesmoNome = await this.prisma.unidade.findUnique({
        where: { nome: updateUnidadeDto.nome },
      });

      if (unidadeComMesmoNome) {
        throw new BadRequestException('Já existe outra unidade com este nome.');
      }
    }

    // Se está tentando atualizar a sigla, verifica se não existe outra com a mesma sigla
    if (
      updateUnidadeDto.sigla &&
      updateUnidadeDto.sigla.toUpperCase() !== unidadeExistente.sigla
    ) {
      const unidadeComMesmaSigla = await this.prisma.unidade.findUnique({
        where: { sigla: updateUnidadeDto.sigla.toUpperCase() },
      });

      if (unidadeComMesmaSigla) {
        throw new BadRequestException(
          'Já existe outra unidade com esta sigla.',
        );
      }
    }

    // Atualiza a unidade
    const unidadeAtualizada = await this.prisma.unidade.update({
      where: { id },
      data: {
        ...(updateUnidadeDto.nome && { nome: updateUnidadeDto.nome }),
        ...(updateUnidadeDto.sigla && {
          sigla: updateUnidadeDto.sigla.toUpperCase(),
        }),
      },
    });

    return unidadeAtualizada;
  }

  /**
   * Remove uma unidade (soft delete - apenas marca como inativa)
   *
   * @param id - ID da unidade a ser removida
   * @returns Confirmação de remoção
   */
  async remover(id: string): Promise<{ removido: boolean }> {
    // Verifica se a unidade existe
    const unidade = await this.buscarPorId(id);

    // Verifica se há usuários ativos relacionados
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        unidade_id: id,
        status: true, // Apenas usuários ativos
      },
    });

    if (usuarios.length > 0) {
      throw new BadRequestException(
        `Não é possível remover a unidade pois existem ${usuarios.length} usuário(s) ativo(s) relacionado(s). Remova ou altere a unidade dos usuários primeiro.`,
      );
    }

    // Verifica se há processos ativos relacionados
    const processos = await this.prisma.processo.findMany({
      where: {
        unidade_id: id,
        ativo: true, // Apenas processos ativos
      },
    });

    if (processos.length > 0) {
      throw new BadRequestException(
        `Não é possível remover a unidade pois existem ${processos.length} processo(s) ativo(s) relacionado(s). Remova ou altere a unidade dos processos primeiro.`,
      );
    }

    // Remove a unidade (soft delete - marca como inativa)
    await this.prisma.unidade.update({
      where: { id },
      data: { ativo: false },
    });

    return { removido: true };
  }
}
