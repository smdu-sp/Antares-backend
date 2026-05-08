import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const grupos = await prisma.grupo.findMany({
    where: { ativo: true },
    orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }, { nome: 'asc' }],
    include: {
      usuarios: {
        where: { ativo: true },
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
      },
      processos: {
        where: { ativo: true },
        select: { id: true },
      },
    },
  });

  const relatorio = grupos.map((grupo) => {
    const usuarios = grupo.usuarios.map((v) => ({
      usuario_id: v.usuario.id,
      nome: v.usuario.nome,
      login: v.usuario.login,
      permissao_sistema: v.usuario.permissao,
      usuario_ativo: v.usuario.status,
      permissao_grupo: v.permissao_grupo,
      capacidades: v.permissao,
    }));

    return {
      grupo: {
        id: grupo.id,
        codigo: grupo.codigo,
        tipo: grupo.tipo,
        nome: grupo.nome,
      },
      totalUsuariosAtivosNoGrupo: usuarios.length,
      totalProcessosVinculadosAtivos: grupo.processos.length,
      usuarios,
    };
  });

  console.log(JSON.stringify(relatorio, null, 2));
}

main()
  .catch((error) => {
    console.error('Erro ao gerar relatorio de acesso por grupo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
