import { Global, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/sgu/client';

@Global()
@Injectable()
export class SguService extends PrismaClient {
  // Conexão lazy - conecta automaticamente quando necessário
}
