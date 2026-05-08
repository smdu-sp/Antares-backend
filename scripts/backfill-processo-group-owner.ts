import 'dotenv/config';
import { PrismaClient, TipoAcao } from '@prisma/client';

const prisma = new PrismaClient();
const CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';

async function obterGrupoAtivoId(usuarioId: string): Promise<string | null> {
  const preferencia = await prisma.preferenciasUsuario.findUnique({
    where: {
      usuario_id_chave: {
        usuario_id: usuarioId,
        chave: CHAVE_GRUPO_ATIVO,
      },
    },
    select: {
      valor: true,
      ativo: true,
    },
  });

  if (preferencia?.ativo && preferencia.valor) {
    const vinculoPreferido = await prisma.usuarioGrupo.findFirst({
      where: {
        usuario_id: usuarioId,
        grupo_id: preferencia.valor,
        ativo: true,
        grupo: {
          ativo: true,
        },
      },
      select: { grupo_id: true },
    });

    if (vinculoPreferido) {
      return vinculoPreferido.grupo_id;
    }
  }

  const vinculo = await prisma.usuarioGrupo.findFirst({
    where: {
      usuario_id: usuarioId,
      ativo: true,
      grupo: {
        ativo: true,
      },
    },
    orderBy: [{ criadoEm: 'asc' }],
    select: { grupo_id: true },
  });

  return vinculo?.grupo_id || null;
}

async function main() {
  const processos = await prisma.processo.findMany({
    where: { ativo: true },
    select: {
      id: true,
      numero_sei: true,
      usuario_atribuido_id: true,
      grupos: {
        where: { ativo: true },
        select: { grupo_id: true },
      },
      andamentos: {
        where: { ativo: true },
        orderBy: { criadoEm: 'asc' },
        take: 1,
        select: {
          usuario_id: true,
        },
      },
    },
  });

  let totalComOwner = 0;
  let ownersPreenchidos = 0;
  let gruposVinculados = 0;
  let semOwner = 0;
  let semGrupoAtivo = 0;

  for (const processo of processos) {
    let ownerId =
      processo.usuario_atribuido_id || processo.andamentos[0]?.usuario_id;

    if (!ownerId) {
      const logCriacao = await prisma.log.findFirst({
        where: {
          ativo: true,
          tipoAcao: TipoAcao.PROCESSO_CRIADO,
          entidadeTipo: 'processo',
          entidadeId: processo.id,
        },
        orderBy: { criadoEm: 'asc' },
        select: { usuario_id: true },
      });

      ownerId = logCriacao?.usuario_id || null;
    }

    if (!ownerId) {
      semOwner += 1;
      continue;
    }

    totalComOwner += 1;

    if (!processo.usuario_atribuido_id) {
      await prisma.processo.update({
        where: { id: processo.id },
        data: {
          usuario_atribuido_id: ownerId,
        },
      });
      ownersPreenchidos += 1;
    }

    const grupoAtivoId = await obterGrupoAtivoId(ownerId);

    if (!grupoAtivoId) {
      semGrupoAtivo += 1;
      continue;
    }

    await prisma.processoGrupo.upsert({
      where: {
        processo_id_grupo_id: {
          processo_id: processo.id,
          grupo_id: grupoAtivoId,
        },
      },
      create: {
        processo_id: processo.id,
        grupo_id: grupoAtivoId,
        nivelVisao: 'TOTAL',
        ativo: true,
      },
      update: {
        ativo: true,
      },
    });

    gruposVinculados += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalProcessosAtivos: processos.length,
        totalComOwner,
        ownersPreenchidos,
        gruposVinculados,
        semOwner,
        semGrupoAtivo,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Erro no backfill de grupo owner dos processos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
