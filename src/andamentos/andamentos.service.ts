import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAndamentoDto } from './dto/create-andamento.dto';
import { UpdateAndamentoDto } from './dto/update-andamento.dto';
import { BatchAndamentoDto } from './dto/batch-andamento.dto';
import { AndamentoResponseDto } from './dto/andamento-response.dto';
import { andamento, $Enums } from '@prisma/client';
import { AppService } from 'src/app.service';
import { LogsService } from 'src/logs/logs.service';

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
    private logsService: LogsService,
  ) {}

  /**
   * Cria um novo andamento (envia processo de uma unidade para outra)
   *
   * @param createAndamentoDto - Dados do andamento
   * @param usuario_id - ID do usuário que está criando o andamento
   * @returns Andamento criado
   */
  async criar(
    createAndamentoDto: CreateAndamentoDto,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    // Verifica se o processo existe
    const processo = await this.prisma.processo.findUnique({
      where: { id: createAndamentoDto.processo_id },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Verifica se o usuário existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuario_id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // Converte a string de data para Date
    const prazo = createAndamentoDto.prazo
      ? new Date(createAndamentoDto.prazo)
      : null;
    const data_envio = createAndamentoDto.data_envio
      ? new Date(createAndamentoDto.data_envio)
      : null;

    // Cria o andamento
    const andamento: andamento = await this.prisma.andamento.create({
      data: {
        processo_id: createAndamentoDto.processo_id,
        origem: createAndamentoDto.origem,
        destino: createAndamentoDto.destino,
        data_envio: data_envio,
        prazo: prazo,
        status:
          createAndamentoDto.status || $Enums.StatusAndamento.EM_ANDAMENTO,
        observacao: createAndamentoDto.observacao,
        assunto: createAndamentoDto.assunto,
        usuario_id: usuario_id,
      },
      include: {
        processo: true,
        usuario: true,
        usuarioProrrogacao: true,
      },
    });

    if (!andamento) {
      throw new InternalServerErrorException(
        'Não foi possível criar o andamento.',
      );
    }

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.ANDAMENTO_CRIADO,
      `Andamento criado: ${andamento.origem} → ${andamento.destino}${andamento.prazo ? ` (Prazo: ${new Date(andamento.prazo).toLocaleDateString('pt-BR')})` : ''}`,
      'andamento',
      andamento.id,
      usuario_id,
      null,
      {
        origem: andamento.origem,
        destino: andamento.destino,
        prazo: andamento.prazo,
        processo_id: andamento.processo_id,
      },
    );

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
  ): Promise<{
    total: number;
    pagina: number;
    limite: number;
    data: AndamentoResponseDto[];
  }> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    const searchParams = {
      ...(processo_id && { processo_id }),
      ...(status &&
        status !== '' && { status: status as $Enums.StatusAndamento }),
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
        usuario: true,
        usuarioProrrogacao: true,
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
  async buscarPorProcesso(
    processo_id: string,
  ): Promise<AndamentoResponseDto[]> {
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
      where: {
        processo_id,
        ativo: true, // Apenas andamentos ativos
      },
      orderBy: { criadoEm: 'desc' },
      include: {
        processo: true,
        usuario: true,
        usuarioProrrogacao: true,
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
        usuario: true,
        usuarioProrrogacao: true,
      },
    });

    if (!andamento || !andamento.ativo) {
      throw new NotFoundException(`Andamento não encontrado ou inativo: ${id}`);
    }

    return andamento;
  }

  /**
   * Atualiza um andamento
   * Permite atualizar status, prorrogação, conclusão e observações
   *
   * @param id - ID do andamento
   * @param updateAndamentoDto - Dados a serem atualizados
   * @param usuario_id - ID do usuário que está atualizando o andamento
   * @returns Andamento atualizado
   */
  async atualizar(
    id: string,
    updateAndamentoDto: UpdateAndamentoDto,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    // Verifica se o andamento existe
    await this.buscarPorId(id);

    // Normaliza payloads inesperados do frontend:
    // - aceita campo `conclusao` como sinônimo de `resposta` (data)
    // - se `resposta` vier como texto não-ISO, tratamos como `observacao`
    const payload: any = updateAndamentoDto as any;
    if (payload.conclusao !== undefined && payload.conclusao !== null) {
      payload.resposta = payload.conclusao;
    }
    if (payload.resposta !== undefined && payload.resposta !== null) {
      const possibleDate = new Date(payload.resposta as any);
      if (isNaN(possibleDate.getTime())) {
        // Trata `resposta` textual como observação (se não houver observacao explicita)
        if (!payload.observacao) {
          payload.observacao = payload.resposta;
        }
        delete payload.resposta;
      }
    }

    // Prepara os dados para atualização
    const data: any = {};

    if (updateAndamentoDto.origem) data.origem = updateAndamentoDto.origem;
    if (updateAndamentoDto.destino) data.destino = updateAndamentoDto.destino;
    if (updateAndamentoDto.data_envio !== undefined) {
      data.data_envio = updateAndamentoDto.data_envio
        ? new Date(updateAndamentoDto.data_envio)
        : null;
    }
    if (updateAndamentoDto.prazo)
      data.prazo = new Date(updateAndamentoDto.prazo);
    // Status não pode ser atualizado manualmente - é definido automaticamente pelas etapas
    if (updateAndamentoDto.observacao !== undefined)
      data.observacao = updateAndamentoDto.observacao;
    if (updateAndamentoDto.assunto !== undefined)
      data.assunto = updateAndamentoDto.assunto;

    // Trata prorrogação - aceita null para limpar o campo
    if (updateAndamentoDto.prorrogacao !== undefined) {
      if (updateAndamentoDto.prorrogacao === null) {
        data.prorrogacao = null;
        data.usuario_prorrogacao_id = null; // Remove o usuário que prorrogou
        // Se a prorrogação foi removida e não há resposta, volta para EM_ANDAMENTO
        if (!updateAndamentoDto.resposta) {
          data.status = $Enums.StatusAndamento.EM_ANDAMENTO;
        }
      } else {
        data.prorrogacao = new Date(updateAndamentoDto.prorrogacao);
        data.usuario_prorrogacao_id = usuario_id; // Registra quem prorrogou
        // Só atualiza status para PRORROGADO se não houver resposta
        if (!updateAndamentoDto.resposta) {
          data.status = $Enums.StatusAndamento.PRORROGADO;
        }
      }
    }

    // Trata resposta - aceita null para limpar o campo
    if (updateAndamentoDto.resposta !== undefined) {
      if (updateAndamentoDto.resposta === null) {
        data.resposta = null;
        // Se a resposta foi removida e não há prorrogação, volta para EM_ANDAMENTO
        if (!updateAndamentoDto.prorrogacao) {
          data.status = $Enums.StatusAndamento.EM_ANDAMENTO;
        }
      } else {
        // Valida que a resposta é uma data válida
        const parsedResposta = new Date(updateAndamentoDto.resposta);
        if (isNaN(parsedResposta.getTime())) {
          throw new BadRequestException(
            'Campo `resposta` deve ser uma data válida em formato ISO 8601.',
          );
        }
        data.resposta = parsedResposta;
        // Resposta tem prioridade sobre prorrogação
        data.status = $Enums.StatusAndamento.CONCLUIDO;
      }
    }

    // Busca dados antigos para log
    const andamentoAntigo = await this.prisma.andamento.findUnique({
      where: { id },
    });

    // Se for uma resposta (conclusão), atualizamos o andamento e, se necessário,
    // também atualizamos o processo relacionado dentro de uma transação para
    // garantir atomicidade e evitar estados parciais.
    let andamentoAtualizado;
    let processoAtualizado: any = null;
    let processoPreUpdate: any = null;

    const isRespostaSet =
      updateAndamentoDto.resposta !== undefined &&
      updateAndamentoDto.resposta !== null;

    if (isRespostaSet) {
      // Converte a data para Date (já preparado em `data` acima)
      const respostaDate = data.resposta as Date;

      // Busca processo atual para decidir se precisamos atualizá-lo
      processoPreUpdate = await this.prisma.processo.findUnique({
        where: { id: andamentoAntigo.processo_id },
        select: { data_resposta_final: true, resposta_final: true },
      });

      // Prepara atualização do processo somente se necessário (não sobrescrever dados existentes)
      const processoUpdateData: any = {};
      if (!processoPreUpdate.data_resposta_final) {
        processoUpdateData.data_resposta_final = respostaDate;
      }
      // Use a observação enviada no update como possível texto da resposta final
      if (!processoPreUpdate.resposta_final && updateAndamentoDto.observacao) {
        processoUpdateData.resposta_final = updateAndamentoDto.observacao;
      }
      // Define unidade_respondida_id como a unidade destino do andamento (quem respondeu)
      if (Object.keys(processoUpdateData).length > 0) {
        processoUpdateData.unidade_respondida_id = andamentoAntigo.destino;
      }

      // Monta operações da transação: atualiza andamento sempre, atualiza processo se necessário
      const ops: any[] = [
        this.prisma.andamento.update({
          where: { id },
          data,
          include: {
            processo: true,
            usuario: true,
            usuarioProrrogacao: true,
          },
        }),
      ];

      if (Object.keys(processoUpdateData).length > 0) {
        ops.push(
          this.prisma.processo.update({
            where: { id: andamentoAntigo.processo_id },
            data: processoUpdateData,
            include: {
              andamentos: false,
            },
          }),
        );
      }

      const results = await this.prisma.$transaction(ops);
      andamentoAtualizado = results[0];
      if (results.length > 1) processoAtualizado = results[1];
    } else {
      // Atualização padrão quando não é resposta
      andamentoAtualizado = await this.prisma.andamento.update({
        where: { id },
        data,
        include: {
          processo: true,
          usuario: true,
          usuarioProrrogacao: true,
        },
      });
    }

    // Determina o tipo de ação para o log
    let tipoAcao: $Enums.TipoAcao = $Enums.TipoAcao.ANDAMENTO_ATUALIZADO;
    let descricao = `Andamento atualizado: ${andamentoAtualizado.origem} → ${andamentoAtualizado.destino}`;

    if (
      updateAndamentoDto.prorrogacao !== undefined &&
      updateAndamentoDto.prorrogacao !== null
    ) {
      tipoAcao = $Enums.TipoAcao.ANDAMENTO_PRORROGADO;
      descricao = `Andamento prorrogado: ${andamentoAtualizado.origem} → ${andamentoAtualizado.destino} (Nova data: ${new Date(andamentoAtualizado.prorrogacao).toLocaleDateString('pt-BR')})`;
    } else if (
      updateAndamentoDto.resposta !== undefined &&
      updateAndamentoDto.resposta !== null
    ) {
      tipoAcao = $Enums.TipoAcao.ANDAMENTO_CONCLUIDO;
      descricao = `Andamento concluído: ${andamentoAtualizado.origem} → ${andamentoAtualizado.destino}`;
    }

    // Registra log
    await this.logsService.criar(
      tipoAcao,
      descricao,
      'andamento',
      andamentoAtualizado.id,
      usuario_id,
      andamentoAntigo
        ? {
            origem: andamentoAntigo.origem,
            destino: andamentoAntigo.destino,
            prazo: andamentoAntigo.prazo,
            prorrogacao: andamentoAntigo.prorrogacao,
            resposta: andamentoAntigo.resposta,
            status: andamentoAntigo.status,
          }
        : null,
      {
        origem: andamentoAtualizado.origem,
        destino: andamentoAtualizado.destino,
        prazo: andamentoAtualizado.prazo,
        prorrogacao: andamentoAtualizado.prorrogacao,
        resposta: andamentoAtualizado.resposta,
        status: andamentoAtualizado.status,
      },
    );

    // Se atualizamos também o processo, registre log específico para o processo
    if (processoAtualizado) {
      await this.logsService.criar(
        $Enums.TipoAcao.PROCESSO_ATUALIZADO,
        `Processo atualizado por conclusão de andamento: ${processoAtualizado.numero_sei || processoAtualizado.id}`,
        'processo',
        processoAtualizado.id,
        usuario_id,
        processoPreUpdate
          ? {
              data_resposta_final: processoPreUpdate.data_resposta_final,
              resposta_final: processoPreUpdate.resposta_final,
            }
          : null,
        {
          data_resposta_final: processoAtualizado.data_resposta_final,
          resposta_final: processoAtualizado.resposta_final,
          unidade_respondida_id: processoAtualizado.unidade_respondida_id,
        },
      );
    }

    return andamentoAtualizado;
  }

  /**
   * Marca um andamento como concluído
   *
   * @param id - ID do andamento
   * @param usuario_id - ID do usuário que está concluindo o andamento
   * @returns Andamento atualizado
   */
  async concluir(
    id: string,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    const andamento = await this.buscarPorId(id);

    if (andamento.status === $Enums.StatusAndamento.CONCLUIDO) {
      throw new BadRequestException('Andamento já está concluído.');
    }

    return this.atualizar(
      id,
      {
        resposta: new Date().toISOString(),
        status: $Enums.StatusAndamento.CONCLUIDO,
      },
      usuario_id,
    );
  }

  /**
   * Prorroga um andamento
   *
   * @param id - ID do andamento
   * @param novaDataLimite - Nova data limite
   * @param usuario_id - ID do usuário que está prorrogando o andamento
   * @returns Andamento atualizado
   */
  async prorrogar(
    id: string,
    novaDataLimite: string,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    const andamento = await this.buscarPorId(id);

    const novaData = new Date(novaDataLimite);
    const dataAtual = new Date();

    if (novaData <= dataAtual) {
      throw new BadRequestException('A nova data limite deve ser futura.');
    }

    return this.atualizar(
      id,
      {
        prorrogacao: novaDataLimite,
        status: $Enums.StatusAndamento.PRORROGADO,
      },
      usuario_id,
    );
  }

  /**
   * Remove um andamento (soft delete - apenas marca como inativo)
   *
   * @param id - ID do andamento
   * @param usuario_id - ID do usuário que está removendo o andamento
   * @returns Confirmação de remoção
   */
  async remover(
    id: string,
    usuario_id: string,
  ): Promise<{ removido: boolean }> {
    const andamento = await this.buscarPorId(id);

    // Remove o andamento (soft delete - marca como inativo)
    await this.prisma.andamento.update({
      where: { id },
      data: { ativo: false },
    });

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.ANDAMENTO_REMOVIDO,
      `Andamento removido: ${andamento.origem} → ${andamento.destino}`,
      'andamento',
      id,
      usuario_id,
      {
        origem: andamento.origem,
        destino: andamento.destino,
        prazo: andamento.prazo,
        processo_id: andamento.processo_id,
      },
      null,
    );

    return { removido: true };
  }

  /**
   * Realiza operações em lote em andamentos (excluir, prorrogar, concluir)
   *
   * @param batchAndamentoDto - Dados da operação em lote
   * @param usuario_id - ID do usuário que está realizando a operação
   * @returns Número de andamentos processados e lista de erros
   */
  async lote(
    batchAndamentoDto: BatchAndamentoDto,
    usuario_id: string,
  ): Promise<{ processados: number; erros: string[] }> {
    const ids = batchAndamentoDto.ids;
    const operacao = batchAndamentoDto.operacao;
    const novaDataLimite =
      batchAndamentoDto.novaDataLimite || batchAndamentoDto.prazo;

    const erros: string[] = [];
    let processados = 0;

    // Validação: ids deve ser um array não vazio
    if (!ids || !Array.isArray(ids)) {
      throw new BadRequestException(
        `Campo 'ids' deve ser um array. Recebido tipo: ${typeof ids}`,
      );
    }

    if (ids.length === 0) {
      throw new BadRequestException(
        'Array de IDs está vazio. Pelo menos um ID é necessário.',
      );
    }

    // Validação: operação deve ser válida
    if (!['excluir', 'prorrogar', 'concluir'].includes(operacao)) {
      throw new BadRequestException(
        `Operação inválida: ${operacao}. Use: excluir, prorrogar ou concluir.`,
      );
    }

    // 3. Validação: novaDataLimite é obrigatória para prorrogação
    if (operacao === 'prorrogar' && !novaDataLimite) {
      throw new BadRequestException(
        'Nova data limite é obrigatória para prorrogação.',
      );
    }

    // Regex para validar formato de UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Processa cada ID individualmente
    for (const id of ids) {
      // Valida se o ID tem formato de UUID válido
      if (!id || typeof id !== 'string') {
        erros.push(`ID inválido (não é string): ${JSON.stringify(id)}`);
        continue;
      }

      if (!uuidRegex.test(id)) {
        erros.push(`ID inválido (formato UUID incorreto): ${id}`);
        continue;
      }

      try {
        switch (operacao) {
          case 'excluir':
            await this.remover(id, usuario_id);
            break;
          case 'prorrogar':
            await this.prorrogar(id, novaDataLimite!, usuario_id);
            break;
          case 'concluir':
            await this.concluir(id, usuario_id);
            break;
          default:
            erros.push(`Operação inválida para ID ${id}: ${operacao}`);
            continue;
        }
        processados++;
      } catch (error) {
        erros.push(
          `Erro ao processar ID ${id} na operação ${operacao}: ${error.message}`,
        );
      }
    }

    return { processados, erros };
  }
}
