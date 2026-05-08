import 'dotenv/config';
import { GrupoCodigo, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_GROUP_ID = 'dee3b6c4-34fa-11f1-a83e-c200e8867779';

async function main() {
  const grupo = await prisma.grupo.findUnique({
    where: { id: TARGET_GROUP_ID },
    select: { id: true, codigo: true, nome: true, ativo: true },
  });

  if (!grupo) {
    throw new Error(`Grupo nao encontrado: ${TARGET_GROUP_ID}`);
  }

  if (grupo.codigo !== GrupoCodigo.GLOBAL) {
    throw new Error(
      `Grupo informado nao e GLOBAL. Codigo atual: ${grupo.codigo}`,
    );
  }

  if (!grupo.ativo) {
    throw new Error('Grupo GLOBAL informado esta inativo.');
  }

  const vinculos = await prisma.usuarioGrupo.findMany({
    where: {
      grupo_id: TARGET_GROUP_ID,
      ativo: true,
    },
    select: {
      id: true,
      usuario_id: true,
      permissao_grupo: true,
      usuario: {
        select: {
          id: true,
          nome: true,
          login: true,
          permissao: true,
          status: true,
        },
      },
    },
    orderBy: { criadoEm: 'asc' },
  });

  for (const vinculo of vinculos) {
    await prisma.usuarioGrupo.update({
      where: { id: vinculo.id },
      data: {
        permissao_grupo: 'ADM',
        ativo: true,
      },
    });

    await prisma.usuarioGrupoPermissao.upsert({
      where: { usuario_grupo_id: vinculo.id },
      create: {
        usuario_grupo_id: vinculo.id,
        visualizar_proprios: true,
        visualizar_grupo: true,
        modificar_proprios: true,
        modificar_grupo: true,
        excluir: true,
        ativo: true,
      },
      update: {
        visualizar_proprios: true,
        visualizar_grupo: true,
        modificar_proprios: true,
        modificar_grupo: true,
        excluir: true,
        ativo: true,
      },
    });
  }

  const resumo = await prisma.usuarioGrupo.findMany({
    where: { grupo_id: TARGET_GROUP_ID, ativo: true },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          login: true,
          permissao: true,
          status: true,
        },
      },
      permissao: {
        select: {
          visualizar_proprios: true,
          visualizar_grupo: true,
          modificar_proprios: true,
          modificar_grupo: true,
          excluir: true,
          ativo: true,
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        grupo,
        totalUsuariosAtivosNoGlobal: resumo.length,
        usuarios: resumo.map((item) => ({
          usuario: item.usuario,
          permissao_grupo: item.permissao_grupo,
          permissao: item.permissao,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Erro ao aplicar privilegios master no grupo GLOBAL:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
