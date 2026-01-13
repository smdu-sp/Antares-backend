import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InteressadoResponseDto } from './dto/interessado-response.dto';
import { CreateInteressadoDto } from './dto/create-interessado.dto';
import { UpdateInteressadoDto } from './dto/update-interessado.dto';

@Injectable()
export class InteressadosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista todos os interessados (sem paginação)
   */
  async listaCompleta(): Promise<InteressadoResponseDto[]> {
    const interessados = await this.prisma.interessado.findMany({
      orderBy: { valor: 'asc' },
    });

    return interessados.map((interessado) => ({
      id: interessado.id,
      valor: interessado.valor,
      criadoEm: interessado.criadoEm,
    }));
  }

  /**
   * Busca interessados por termo para autocomplete
   */
  async buscarPorTermo(termo: string): Promise<InteressadoResponseDto[]> {
    const interessados = await this.prisma.interessado.findMany({
      where: {
        valor: {
          contains: termo,
        },
      },
      orderBy: { valor: 'asc' },
      take: 10, // Limita a 10 resultados para performance
    });

    return interessados.map((interessado) => ({
      id: interessado.id,
      valor: interessado.valor,
      criadoEm: interessado.criadoEm,
    }));
  }

  /**
   * Cria um novo interessado
   */
  async criar(
    createInteressadoDto: CreateInteressadoDto,
  ): Promise<InteressadoResponseDto> {
    // Verifica se já existe um interessado com o mesmo nome
    const interessadoExistente = await this.prisma.interessado.findFirst({
      where: { valor: createInteressadoDto.valor.trim() },
    });

    if (interessadoExistente) {
      throw new BadRequestException('Já existe um interessado com este nome.');
    }

    // Cria o interessado
    const interessado = await this.prisma.interessado.create({
      data: {
        valor: createInteressadoDto.valor.trim(),
      },
    });

    return {
      id: interessado.id,
      valor: interessado.valor,
      criadoEm: interessado.criadoEm,
    };
  }

  /**
   * Busca um interessado por ID
   */
  async buscarPorId(id: string): Promise<InteressadoResponseDto> {
    const interessado = await this.prisma.interessado.findUnique({
      where: { id },
    });

    if (!interessado) {
      throw new NotFoundException('Interessado não encontrado.');
    }

    return {
      id: interessado.id,
      valor: interessado.valor,
      criadoEm: interessado.criadoEm,
    };
  }

  /**
   * Atualiza um interessado
   */
  async atualizar(
    id: string,
    updateInteressadoDto: UpdateInteressadoDto,
  ): Promise<InteressadoResponseDto> {
    // Verifica se o interessado existe
    const interessadoExistente = await this.prisma.interessado.findUnique({
      where: { id },
    });

    if (!interessadoExistente) {
      throw new NotFoundException('Interessado não encontrado.');
    }

    // Se está atualizando o valor, verifica se não existe outro com o mesmo nome
    if (updateInteressadoDto.valor) {
      const interessadoComMesmoNome = await this.prisma.interessado.findFirst({
        where: {
          valor: updateInteressadoDto.valor.trim(),
          id: { not: id },
        },
      });

      if (interessadoComMesmoNome) {
        throw new BadRequestException(
          'Já existe outro interessado com este nome.',
        );
      }
    }

    // Atualiza o interessado
    const interessado = await this.prisma.interessado.update({
      where: { id },
      data: {
        valor: updateInteressadoDto.valor?.trim(),
      },
    });

    return {
      id: interessado.id,
      valor: interessado.valor,
      criadoEm: interessado.criadoEm,
    };
  }

  /**
   * Remove um interessado
   */
  async remover(id: string): Promise<{ removido: boolean }> {
    // Verifica se o interessado existe
    const interessado = await this.prisma.interessado.findUnique({
      where: { id },
    });

    if (!interessado) {
      throw new NotFoundException('Interessado não encontrado.');
    }

    // Verifica se há processos vinculados
    const processosVinculados = await this.prisma.processo.count({
      where: { interessado_id: id },
    });

    if (processosVinculados > 0) {
      throw new BadRequestException(
        `Não é possível remover este interessado pois existem ${processosVinculados} processo(s) vinculado(s).`,
      );
    }

    // Remove o interessado
    await this.prisma.interessado.delete({
      where: { id },
    });

    return { removido: true };
  }
}
