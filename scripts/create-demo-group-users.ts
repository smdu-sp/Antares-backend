import 'dotenv/config';
import {
  GrupoCodigo,
  GrupoTipo,
  Permissao,
  PermissaoGrupo,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

function makeLogin(prefix: string) {
  const stamp = Date.now().toString().slice(-6);
  return `${prefix}.${stamp}`;
}

async function ensureUnidadeId() {
  const unidade = await prisma.unidade.findFirst({
    where: { ativo: true },
    select: { id: true },
    orderBy: { criadoEm: 'asc' },
  });

  if (unidade) {
    return unidade.id;
  }

  const suffix = Date.now().toString().slice(-6);
  const created = await prisma.unidade.create({
    data: {
      nome: `UNIDADE TESTE ${suffix}`,
      sigla: `UT${suffix}`,
      ativo: true,
    },
    select: { id: true },
  });

  return created.id;
}

async function ensureGrupo(codigo: GrupoCodigo, nome: string) {
  return prisma.grupo.upsert({
    where: {
      codigo_tipo: {
        codigo,
        tipo: GrupoTipo.COORDENADORIA,
      },
    },
    create: {
      codigo,
      tipo: GrupoTipo.COORDENADORIA,
      nome,
      ativo: true,
    },
    update: {
      nome,
      ativo: true,
    },
    select: { id: true, codigo: true, nome: true },
  });
}

async function createUserWithGroup(params: {
  nome: string;
  loginPrefix: string;
  emailPrefix: string;
  grupoId: string;
  permissaoGrupo: PermissaoGrupo;
  unidadeId: string;
}) {
  const login = makeLogin(params.loginPrefix);
  const email = `${params.emailPrefix}.${Date.now()}@exemplo.local`;

  const usuario = await prisma.usuario.create({
    data: {
      nome: params.nome,
      login,
      email,
      permissao: Permissao.USR,
      status: true,
      unidade_id: params.unidadeId,
    },
    select: {
      id: true,
      nome: true,
      login: true,
      email: true,
    },
  });

  const usuarioGrupo = await prisma.usuarioGrupo.upsert({
    where: {
      usuario_id_grupo_id: {
        usuario_id: usuario.id,
        grupo_id: params.grupoId,
      },
    },
    create: {
      usuario_id: usuario.id,
      grupo_id: params.grupoId,
      permissao_grupo: params.permissaoGrupo,
      ativo: true,
    },
    update: {
      permissao_grupo: params.permissaoGrupo,
      ativo: true,
    },
    select: { id: true },
  });

  await prisma.usuarioGrupoPermissao.upsert({
    where: { usuario_grupo_id: usuarioGrupo.id },
    create: {
      usuario_grupo_id: usuarioGrupo.id,
      visualizar_proprios: true,
      visualizar_grupo: true,
      modificar_proprios: true,
      modificar_grupo: false,
      excluir: false,
      ativo: true,
    },
    update: {
      ativo: true,
    },
  });

  return usuario;
}

async function main() {
  const unidadeId = await ensureUnidadeId();

  const grupoServin = await ensureGrupo(
    GrupoCodigo.SERVIN,
    'Coordenadoria Servin',
  );
  const grupoExpediente = await ensureGrupo(
    GrupoCodigo.EXPEDIENTE,
    'Coordenadoria Expediente',
  );

  const usuarioServin = await createUserWithGroup({
    nome: 'Usuario Teste Servin',
    loginPrefix: 'user.servin',
    emailPrefix: 'user.servin',
    grupoId: grupoServin.id,
    permissaoGrupo: PermissaoGrupo.USR,
    unidadeId,
  });

  const usuarioExpediente = await createUserWithGroup({
    nome: 'Usuario Teste Expediente',
    loginPrefix: 'user.expediente',
    emailPrefix: 'user.expediente',
    grupoId: grupoExpediente.id,
    permissaoGrupo: PermissaoGrupo.USR,
    unidadeId,
  });

  const resultado = {
    senhaSugestao: 'Senha@123',
    observacao:
      'Se ENVIRONMENT=local, qualquer senha autentica para usuarios ativos. Em ambiente LDAP, use senha do AD.',
    usuarios: [
      {
        tipo: 'SERVIN',
        ...usuarioServin,
      },
      {
        tipo: 'EXPEDIENTE',
        ...usuarioExpediente,
      },
    ],
  };

  console.log(JSON.stringify(resultado, null, 2));
}

main()
  .catch((error) => {
    console.error('Erro ao criar usuarios de teste:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
