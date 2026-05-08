import 'dotenv/config';
import { GrupoCodigo, GrupoTipo, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOVO_OWNER_ID = '9a97724e-70f0-4bd6-8f6c-cf87db0c87ed';

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const owner = await tx.usuario.findUnique({
      where: { id: NOVO_OWNER_ID },
      select: { id: true, nome: true, login: true, status: true },
    });

    if (!owner) {
      throw new Error(`Usuario owner nao encontrado: ${NOVO_OWNER_ID}`);
    }

    if (!owner.status) {
      throw new Error(`Usuario owner esta inativo: ${NOVO_OWNER_ID}`);
    }

    const grupoExpediente = await tx.grupo.findUnique({
      where: {
        codigo_tipo: {
          codigo: GrupoCodigo.EXPEDIENTE,
          tipo: GrupoTipo.COORDENADORIA,
        },
      },
      select: { id: true, codigo: true, tipo: true, nome: true, ativo: true },
    });

    if (!grupoExpediente) {
      throw new Error('Grupo EXPEDIENTE/COORDENADORIA nao encontrado.');
    }

    if (!grupoExpediente.ativo) {
      throw new Error('Grupo EXPEDIENTE/COORDENADORIA esta inativo.');
    }

    const processos = await tx.processo.findMany({
      select: { id: true },
    });

    const processoIds = processos.map((p) => p.id);

    const ownerUpdate = await tx.processo.updateMany({
      where: {},
      data: {
        usuario_atribuido_id: NOVO_OWNER_ID,
      },
    });

    let vinculosDesativados = 0;
    let vinculosAtivados = 0;

    if (processoIds.length > 0) {
      const desativacao = await tx.processoGrupo.updateMany({
        where: {
          processo_id: { in: processoIds },
          ativo: true,
        },
        data: { ativo: false },
      });
      vinculosDesativados = desativacao.count;

      for (const processoId of processoIds) {
        await tx.processoGrupo.upsert({
          where: {
            processo_id_grupo_id: {
              processo_id: processoId,
              grupo_id: grupoExpediente.id,
            },
          },
          create: {
            processo_id: processoId,
            grupo_id: grupoExpediente.id,
            nivelVisao: 'TOTAL',
            ativo: true,
          },
          update: {
            ativo: true,
          },
        });
      }

      vinculosAtivados = processoIds.length;
    }

    const totalProcessos = await tx.processo.count();
    const totalComOwnerNovo = await tx.processo.count({
      where: { usuario_atribuido_id: NOVO_OWNER_ID },
    });

    const totalVinculosExpedienteAtivos = await tx.processoGrupo.count({
      where: {
        ativo: true,
        grupo_id: grupoExpediente.id,
      },
    });

    const totalVinculosNaoExpedienteAtivos = await tx.processoGrupo.count({
      where: {
        ativo: true,
        NOT: { grupo_id: grupoExpediente.id },
      },
    });

    return {
      owner,
      grupoExpediente,
      totalProcessos,
      processosAtualizadosOwner: ownerUpdate.count,
      vinculosDesativados,
      vinculosAtivados,
      totalComOwnerNovo,
      totalVinculosExpedienteAtivos,
      totalVinculosNaoExpedienteAtivos,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('Erro ao migrar processos para EXPEDIENTE:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
