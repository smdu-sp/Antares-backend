import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarPreferenciaDto } from './dto/salvar-preferencia.dto';

@Injectable()
export class PreferenciasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Salva ou atualiza uma preferência do usuário
   */
  async salvar(usuario_id: string, dto: SalvarPreferenciaDto) {
    return await this.prisma.preferenciasUsuario.upsert({
      where: {
        usuario_id_chave: {
          usuario_id,
          chave: dto.chave,
        },
      },
      create: {
        usuario_id,
        chave: dto.chave,
        valor: dto.valor,
      },
      update: {
        valor: dto.valor,
        atualizadoEm: new Date(),
      },
    });
  }

  /**
   * Busca uma preferência específica do usuário
   */
  async buscar(usuario_id: string, chave: string) {
    const preferencia = await this.prisma.preferenciasUsuario.findUnique({
      where: {
        usuario_id_chave: {
          usuario_id,
          chave,
        },
      },
    });

    if (!preferencia) {
      return null;
    }

    return {
      chave: preferencia.chave,
      valor: preferencia.valor,
      atualizadoEm: preferencia.atualizadoEm,
    };
  }

  /**
   * Busca todas as preferências do usuário
   */
  async buscarTodas(usuario_id: string) {
    const preferencias = await this.prisma.preferenciasUsuario.findMany({
      where: { usuario_id },
      select: {
        id: true,
        chave: true,
        valor: true,
        atualizadoEm: true,
      },
      orderBy: { chave: 'asc' },
    });

    return preferencias;
  }

  /**
   * Deleta uma preferência do usuário
   */
  async deletar(usuario_id: string, chave: string) {
    try {
      await this.prisma.preferenciasUsuario.delete({
        where: {
          usuario_id_chave: {
            usuario_id,
            chave,
          },
        },
      });
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Preferência não encontrada' };
    }
  }

  /**
   * Deleta todas as preferências do usuário
   */
  async deletarTodas(usuario_id: string) {
    await this.prisma.preferenciasUsuario.deleteMany({
      where: { usuario_id },
    });
    return { success: true };
  }
}
