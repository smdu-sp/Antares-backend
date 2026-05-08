import { SetMetadata } from '@nestjs/common';

export const RequerCapacidade = (...capacidades: string[]) =>
  SetMetadata('capacidades', capacidades);
