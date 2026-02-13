import {
  BadRequestException,
  ForbiddenException,
  Global,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, Permissao, Usuario } from '@prisma/client';
import { AppService } from 'src/app.service';
import { Client as LdapClient } from 'ldapts';
import {
  BuscarNovoResponseDTO,
  UsuarioAutorizadoResponseDTO,
  UsuarioPaginadoResponseDTO,
  UsuarioResponseDTO,
} from './dto/usuario-response.dto';

@Global()
@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  validaPermissaoCriador(
    permissao: $Enums.Permissao,
    permissaoCriador: $Enums.Permissao,
  ) {
    if (
      permissao === $Enums.Permissao.DEV &&
      permissaoCriador === $Enums.Permissao.ADM
    )
      permissao = $Enums.Permissao.ADM;
    return permissao;
  }

  async permitido(id: string, permissoes: string[]): Promise<boolean> {
    if (!id || id === '') throw new BadRequestException('ID vazio.');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { permissao: true },
    });
    if (usuario.permissao === 'DEV') return true;
    return permissoes.some((permissao) => permissao === usuario.permissao);
  }

  async listaCompleta(): Promise<UsuarioResponseDTO[]> {
    const lista: Usuario[] = await this.prisma.usuario.findMany({
      orderBy: { nome: 'asc' },
      include: {
        unidade: {
          select: {
            id: true,
            nome: true,
            sigla: true,
          },
        },
      },
    });
    if (!lista || lista.length == 0)
      throw new ForbiddenException('Nenhum usuário encontrado.');
    return lista;
  }

  async buscarTecnicos(): Promise<{ id: string; nome: string }[]> {
    const lista: { id: string; nome: string }[] =
      await this.prisma.usuario.findMany({
        where: { permissao: 'TEC' },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      });
    if (!lista || lista.length == 0)
      throw new ForbiddenException('Nenhum técnico encontrado.');
    return lista;
  }

  async criar(
    createUsuarioDto: CreateUsuarioDto,
    usuarioLogado: Usuario,
  ): Promise<UsuarioResponseDTO> {
    const loguser: UsuarioResponseDTO = await this.buscarPorLogin(
      createUsuarioDto.login,
    );
    if (loguser) throw new ForbiddenException('Login já cadastrado.');
    const emailuser: UsuarioResponseDTO = await this.buscarPorEmail(
      createUsuarioDto.email,
    );
    if (emailuser) throw new ForbiddenException('Email já cadastrado.');

    // Verifica se a unidade existe
    if (createUsuarioDto.unidade_id) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: createUsuarioDto.unidade_id },
      });
      if (!unidade) {
        throw new BadRequestException('Unidade não encontrada.');
      }
    } else {
      throw new BadRequestException('Unidade é obrigatória.');
    }

    let { permissao } = createUsuarioDto;
    permissao = this.validaPermissaoCriador(permissao, usuarioLogado.permissao);
    const usuario: Usuario = await this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        permissao,
      },
    });
    if (!usuario)
      throw new InternalServerErrorException(
        'Não foi possível criar o usuário, tente novamente.',
      );
    return usuario;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
    permissao?: string,
  ): Promise<UsuarioPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const searchParams = {
      ...(busca && {
        OR: [
          { nome: { contains: busca } },
          { nomeSocial: { contains: busca } },
          { login: { contains: busca } },
          { email: { contains: busca } },
        ],
      }),
      ...(status &&
        status !== '' && {
          status:
            status === 'ATIVO'
              ? true
              : status === 'INATIVO'
                ? false
                : undefined,
        }),
      ...(permissao && permissao !== '' && { permissao: Permissao[permissao] }),
    };
    const total: number = await this.prisma.usuario.count({
      where: searchParams,
    });
    if (total == 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const usuarios: Usuario[] = await this.prisma.usuario.findMany({
      where: searchParams,
      orderBy: { nome: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
      include: {
        unidade: {
          select: {
            id: true,
            nome: true,
            sigla: true,
          },
        },
      },
    });
    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: usuarios,
    };
  }

  async buscarPorId(id: string): Promise<UsuarioResponseDTO> {
    const usuario: Usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        unidade: {
          select: {
            id: true,
            nome: true,
            sigla: true,
          },
        },
      },
    });
    return usuario;
  }

  async buscarPorEmail(email: string): Promise<UsuarioResponseDTO> {
    return await this.prisma.usuario.findUnique({ where: { email } });
  }

  async buscarPorLogin(login: string): Promise<UsuarioResponseDTO> {
    return await this.prisma.usuario.findUnique({ where: { login } });
  }

  async atualizar(
    usuario: Usuario,
    id: string,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioResponseDTO> {
    const usuarioLogado = await this.buscarPorId(usuario.id);
    if (updateUsuarioDto.login) {
      const usuario = await this.buscarPorLogin(updateUsuarioDto.login);
      if (usuario && usuario.id !== id)
        throw new ForbiddenException('Login já cadastrado.');
    }
    const usuarioAntes = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (
      ['TEC', 'USR'].includes(usuarioAntes.permissao) &&
      id !== usuarioAntes.id
    )
      throw new ForbiddenException(
        'Operação não autorizada para este usuário.',
      );

    // Verifica se a unidade existe (se estiver sendo atualizada)
    if (updateUsuarioDto.unidade_id) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: updateUsuarioDto.unidade_id },
      });
      if (!unidade) {
        throw new BadRequestException('Unidade não encontrada.');
      }
    }

    let { permissao } = updateUsuarioDto;
    permissao =
      permissao && permissao.toString() !== ''
        ? this.validaPermissaoCriador(permissao, usuarioLogado.permissao)
        : usuarioAntes.permissao;
    const usuarioAtualizado: Usuario = await this.prisma.usuario.update({
      data: {
        ...updateUsuarioDto,
        permissao,
      },
      where: { id },
    });
    return usuarioAtualizado;
  }

  async excluir(id: string): Promise<{ desativado: boolean }> {
    await this.prisma.usuario.update({
      data: { status: false },
      where: { id },
    });
    return { desativado: true };
  }

  async autorizaUsuario(id: string): Promise<UsuarioAutorizadoResponseDTO> {
    const autorizado: Usuario = await this.prisma.usuario.update({
      where: { id },
      data: { status: true },
    });
    if (autorizado && autorizado.status === true) return { autorizado: true };
    throw new ForbiddenException('Erro ao autorizar o usuário.');
  }

  async validaUsuario(id: string): Promise<UsuarioResponseDTO> {
    const usuario: Usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    if (usuario.status !== true)
      throw new ForbiddenException('Usuário inativo.');
    return usuario;
  }

  async buscarPorNome(
    nome_busca: string,
  ): Promise<{ nome: string; email: string; login: string }> {
    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER,
    });
    try {
      await client.bind(
        `${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`,
        process.env.PASS_LDAP,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Não foi possível conectar ao servidor LDAP.',
      );
    }
    let nome: string, email: string, login: string;
    try {
      const usuario = await client.search(process.env.LDAP_BASE, {
        filter: `(name=${nome_busca})`,
        scope: 'sub',
        attributes: ['name', 'mail', 'samaccountname'],
      });

      if (!usuario.searchEntries || usuario.searchEntries.length === 0) {
        throw new NotFoundException('Usuário não encontrado no LDAP.');
      }

      const entry = usuario.searchEntries[0];
      const { name, mail, samaccountname } = entry;

      if (!name) {
        throw new InternalServerErrorException(
          'Nome do usuário não encontrado no LDAP.',
        );
      }

      if (!samaccountname) {
        throw new InternalServerErrorException(
          'Login do usuário não encontrado no LDAP.',
        );
      }

      nome = name.toString();
      email = mail ? mail.toString().toLowerCase() : '';
      login = samaccountname.toString().toLowerCase();

      await client.unbind();
      return { nome, email, login };
    } catch (error) {
      await client.unbind();
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao buscar usuário no LDAP.');
    }
  }

  async buscarNovo(login: string): Promise<BuscarNovoResponseDTO> {
    // Primeiro verifica se o usuário já existe no banco
    const usuarioExiste = await this.buscarPorLogin(login);
    if (usuarioExiste && usuarioExiste.status === true)
      throw new ForbiddenException('Login já cadastrado.');
    if (usuarioExiste && usuarioExiste.status !== true) {
      const usuarioReativado = await this.prisma.usuario.update({
        where: { id: usuarioExiste.id },
        data: { status: true },
      });
      return usuarioReativado;
    }

    // Se não existe, busca no LDAP
    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER,
    });

    try {
      await client.bind(
        `${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`,
        process.env.PASS_LDAP,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Não foi possível conectar ao servidor LDAP.',
      );
    }

    let nome: string, email: string;
    try {
      // Escapar caracteres especiais no login para o filtro LDAP
      const escapedLogin = login.replace(/[()*\\]/g, '\\$&');
      console.log(
        `Buscando usuário ${login} no LDAP com filtro: (samaccountname=${escapedLogin})`,
      );

      const usuario = await client.search(process.env.LDAP_BASE, {
        filter: `(samaccountname=${escapedLogin})`,
        scope: 'sub',
        attributes: ['name', 'mail'],
      });

      console.log(
        `Resultado da busca LDAP: ${usuario.searchEntries?.length || 0} entradas encontradas`,
      );

      if (!usuario.searchEntries || usuario.searchEntries.length === 0) {
        console.log(`Usuário ${login} não encontrado no LDAP`);
        throw new NotFoundException('Usuário não encontrado no LDAP.');
      }

      const entry = usuario.searchEntries[0];
      console.log(`Entrada LDAP encontrada:`, entry);
      const { name, mail } = entry;

      if (!name) {
        console.error(`Nome não encontrado para usuário ${login}:`, entry);
        throw new InternalServerErrorException(
          'Nome do usuário não encontrado no LDAP.',
        );
      }

      // Email é opcional, mas vamos logar se não existir
      if (!mail) {
        console.warn(
          `Email não encontrado para usuário ${login}, usando email padrão`,
        );
        email = `${login}@rede.sp`; // Email padrão baseado no login
      } else {
        email = mail.toString().toLowerCase();
      }

      nome = name.toString();
      await client.unbind();
    } catch (error) {
      await client.unbind();
      console.error(`Erro ao buscar usuário ${login} no LDAP:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao buscar usuário no LDAP.');
    }

    if (!nome || !email) throw new NotFoundException('Usuário não encontrado.');
    return { login, nome, email };
  }

  async atualizarUltimoLogin(id: string) {
    await this.prisma.usuario.update({
      where: { id },
      data: { ultimoLogin: new Date() },
    });
  }
}
