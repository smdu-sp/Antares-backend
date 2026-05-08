import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_ID = '60bdfd8b-8e4e-40f5-9d16-b4f9ff4f3aeb';
const TARGET_GROUP_ID = 'dee3b6c4-34fa-11f1-a83e-c200e8867779';
const CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { id: USER_ID },
      select: { id: true, nome: true, login: true },
    });

    if (!usuario) {
      throw new Error(`Usuario nao encontrado: ${USER_ID}`);
    }

    const grupo = await tx.grupo.findUnique({
      where: { id: TARGET_GROUP_ID },
      select: { id: true, codigo: true, nome: true, ativo: true },
    });

    if (!grupo) {
      throw new Error(`Grupo nao encontrado: ${TARGET_GROUP_ID}`);
    }

    if (!grupo.ativo) {
      throw new Error(`Grupo informado esta inativo: ${TARGET_GROUP_ID}`);
    }

    // Desativa todos os outros vinculos do usuario.
    const outros = await tx.usuarioGrupo.findMany({
      where: {
        usuario_id: USER_ID,
        NOT: { grupo_id: TARGET_GROUP_ID },
      },
      select: { id: true },
    });

    if (outros.length > 0) {
      const outrosIds = outros.map((item) => item.id);

      await tx.usuarioGrupo.updateMany({
        where: { id: { in: outrosIds } },
        data: { ativo: false },
      });

      await tx.usuarioGrupoPermissao.updateMany({
        where: { usuario_grupo_id: { in: outrosIds } },
        data: { ativo: false },
      });
    }

    // Garante vinculo ativo no grupo alvo com papel ADM.
    const vinculo = await tx.usuarioGrupo.upsert({
      where: {
        usuario_id_grupo_id: {
          usuario_id: USER_ID,
          grupo_id: TARGET_GROUP_ID,
        },
      },
      create: {
        usuario_id: USER_ID,
        grupo_id: TARGET_GROUP_ID,
        permissao_grupo: 'ADM',
        ativo: true,
      },
      update: {
        permissao_grupo: 'ADM',
        ativo: true,
      },
      select: { id: true, permissao_grupo: true, ativo: true },
    });

    // Habilita todas as permissoes combinaveis disponiveis para o grupo.
    const permissao = await tx.usuarioGrupoPermissao.upsert({
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
      select: {
        visualizar_proprios: true,
        visualizar_grupo: true,
        modificar_proprios: true,
        modificar_grupo: true,
        excluir: true,
        ativo: true,
      },
    });

    // Define grupo ativo do usuario para o grupo alvo.
    await tx.preferenciasUsuario.upsert({
      where: {
        usuario_id_chave: {
          usuario_id: USER_ID,
          chave: CHAVE_GRUPO_ATIVO,
        },
      },
      create: {
        usuario_id: USER_ID,
        chave: CHAVE_GRUPO_ATIVO,
        valor: TARGET_GROUP_ID,
        ativo: true,
      },
      update: {
        valor: TARGET_GROUP_ID,
        ativo: true,
      },
    });

    const vinculos = await tx.usuarioGrupo.findMany({
      where: { usuario_id: USER_ID },
      include: {
        grupo: {
          select: { id: true, codigo: true, nome: true, ativo: true },
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
      orderBy: { criadoEm: 'asc' },
    });

    return {
      usuario,
      grupoAlvo: grupo,
      vinculoAlvo: vinculo,
      permissaoAlvo: permissao,
      vinculos,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('Erro ao ajustar usuario para grupo unico:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
