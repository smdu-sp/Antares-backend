import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAndamentoDto } from './dto/create-andamento.dto';
import { UpdateAndamentoDto } from './dto/update-andamento.dto';
import { AndamentoResponseDto } from './dto/andamento-response.dto';
import { andamento, $Enums } from '@prisma/client';
import { AppService } from 'src/app.service';

/**
 * Service para gerenciar andamentos de processos
 * 
 * Andamento representa o envio de um processo de uma unidade para outra,
 * com controle de prazos, prorrogações e conclusões.
 */
@Injectable()
export class AndamentosService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  /**
   * Cria um novo andamento (envia processo de uma unidade para outra)
   * 
   * @param createAndamentoDto - Dados do andamento
   * @returns Andamento criado
   */
  async criar(createAndamentoDto: CreateAndamentoDto): Promise<AndamentoResponseDto> {
    // Verifica se o processo existe
    const processo = await this.prisma.processo.findUnique({
      where: { id: createAndamentoDto.processo_id },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Converte a string de data para Date
    const prazo = new Date(createAndamentoDto.prazo);

    // Cria o andamento
    const andamento: andamento = await this.prisma.andamento.create({
      data: {
        processo_id: createAndamentoDto.processo_id,
        origem: createAndamentoDto.origem,
        destino: createAndamentoDto.destino,
        prazo: prazo,
        status: createAndamentoDto.status || $Enums.StatusAndamento.EM_ANDAMENTO,
        observacao: createAndamentoDto.observacao,
      },
      include: {
        processo: true,
      },
    });

    if (!andamento) {
      throw new InternalServerErrorException('Não foi possível criar o andamento.');
    }

    return andamento;
  }

  /**
   * Busca todos os andamentos com paginação
   * 
   * @param pagina - Número da página
   * @param limite - Itens por página
   * @param processo_id - Filtrar por processo (opcional)
   * @param status - Filtrar por status (opcional)
   * @returns Lista paginada de andamentos
   */
  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    processo_id?: string,
    status?: string,
  ): Promise<{ total: number; pagina: number; limite: number; data: AndamentoResponseDto[] }> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    const searchParams = {
      ...(processo_id && { processo_id }),
      ...(status && status !== '' && { status: status as $Enums.StatusAndamento }),
    };

    const total: number = await this.prisma.andamento.count({
      where: searchParams,
    });

    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    const andamentos: andamento[] = await this.prisma.andamento.findMany({
      where: searchParams,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
      include: {
        processo: true,
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: andamentos,
    };
  }

  /**
   * Busca andamentos de um processo específico
   * 
   * @param processo_id - ID do processo
   * @returns Lista de andamentos do processo
   */
  async buscarPorProcesso(processo_id: string): Promise<AndamentoResponseDto[]> {
    if (!processo_id || processo_id === '') {
      throw new BadRequestException('ID do processo é obrigatório.');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id: processo_id },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    const andamentos = await this.prisma.andamento.findMany({
      where: { processo_id },
      orderBy: { criadoEm: 'desc' },
      include: {
        processo: true,
      },
    });

    return andamentos;
  }

  /**
   * Busca um andamento por ID
   * 
   * @param id - ID do andamento
   * @returns Andamento encontrado
   */
  async buscarPorId(id: string): Promise<AndamentoResponseDto> {
    if (!id || id === '') {
      throw new BadRequestException('ID do andamento é obrigatório.');
    }

    const andamento = await this.prisma.andamento.findUnique({
      where: { id },
      include: {
        processo: true,
      },
    });

    if (!andamento) {
      throw new NotFoundException('Andamento não encontrado.');
    }

    return andamento;
  }

  /**
   * Atualiza um andamento
   * Permite atualizar status, prorrogação, conclusão e observações
   * 
   * @param id - ID do andamento
   * @param updateAndamentoDto - Dados a serem atualizados
   * @returns Andamento atualizado
   */
  async atualizar(
    id: string,
    updateAndamentoDto: UpdateAndamentoDto,
  ): Promise<AndamentoResponseDto> {
    // Verifica se o andamento existe
    await this.buscarPorId(id);

    // Prepara os dados para atualização
    const data: any = {};

    if (updateAndamentoDto.origem) data.origem = updateAndamentoDto.origem;
    if (updateAndamentoDto.destino) data.destino = updateAndamentoDto.destino;
    if (updateAndamentoDto.prazo) data.prazo = new Date(updateAndamentoDto.prazo);
    // Status não pode ser atualizado manualmente - é definido automaticamente pelas etapas
    if (updateAndamentoDto.observacao !== undefined) data.observacao = updateAndamentoDto.observacao;
    
    // Trata prorrogação - aceita null para limpar o campo
    if (updateAndamentoDto.prorrogacao !== undefined) {
      if (updateAndamentoDto.prorrogacao === null) {
        data.prorrogacao = null;
        // Se a prorrogação foi removida e não há conclusão, volta para EM_ANDAMENTO
        if (!updateAndamentoDto.conclusao) {
          data.status = $Enums.StatusAndamento.EM_ANDAMENTO;
        }
      } else {
        data.prorrogacao = new Date(updateAndamentoDto.prorrogacao);
        // Só atualiza status para PRORROGADO se não houver conclusão
        if (!updateAndamentoDto.conclusao) {
          data.status = $Enums.StatusAndamento.PRORROGADO;
        }
      }
    }
    
    // Trata conclusão - aceita null para limpar o campo
    if (updateAndamentoDto.conclusao !== undefined) {
      if (updateAndamentoDto.conclusao === null) {
        data.conclusao = null;
        // Se a conclusão foi removida e não há prorrogação, volta para EM_ANDAMENTO
        if (!updateAndamentoDto.prorrogacao) {
          data.status = $Enums.StatusAndamento.EM_ANDAMENTO;
        }
      } else {
        data.conclusao = new Date(updateAndamentoDto.conclusao);
        // Conclusão tem prioridade sobre prorrogação
        data.status = $Enums.StatusAndamento.CONCLUIDO;
      }
    }
    

    // Atualiza o andamento
    const andamentoAtualizado = await this.prisma.andamento.update({
      where: { id },
      data,
      include: {
        processo: true,
      },
    });

    return andamentoAtualizado;
  }

  /**
   * Marca um andamento como concluído
   * 
   * @param id - ID do andamento
   * @returns Andamento atualizado
   */
  async concluir(id: string): Promise<AndamentoResponseDto> {
    const andamento = await this.buscarPorId(id);

    if (andamento.status === $Enums.StatusAndamento.CONCLUIDO) {
      throw new BadRequestException('Andamento já está concluído.');
    }

    return this.atualizar(id, {
      conclusao: new Date().toISOString(),
      status: $Enums.StatusAndamento.CONCLUIDO,
    });
  }

  /**
   * Prorroga um andamento
   * 
   * @param id - ID do andamento
   * @param novaDataLimite - Nova data limite
   * @returns Andamento atualizado
   */
  async prorrogar(id: string, novaDataLimite: string): Promise<AndamentoResponseDto> {
    const andamento = await this.buscarPorId(id);

    const novaData = new Date(novaDataLimite);
    const dataAtual = new Date();

    if (novaData <= dataAtual) {
      throw new BadRequestException('A nova data limite deve ser futura.');
    }

    return this.atualizar(id, {
      prorrogacao: novaDataLimite,
      status: $Enums.StatusAndamento.PRORROGADO,
    });
  }

  /**
   * Remove um andamento
   * 
   * @param id - ID do andamento
   * @returns Confirmação de remoção
   */
  async remover(id: string): Promise<{ removido: boolean }> {
    await this.buscarPorId(id);

    await this.prisma.andamento.delete({
      where: { id },
    });

    return { removido: true };
  }
}

