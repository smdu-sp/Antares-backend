import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { stringify } from 'json-bigint';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. PRIMEIRO: Parse do JSON/URL-encoded (para popular req.body)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 2. DEPOIS: Middleware de debug (agora req.body está populado)
  app.use((req, res, next) => {
    if (req.url.includes('/andamentos/lote')) {
      console.log('[MAIN] ========== DEBUG REQUISIÇÃO LOTE ==========');
      console.log('[MAIN] URL:', req.url);
      console.log('[MAIN] Method:', req.method);
      console.log('[MAIN] Content-Type:', req.headers['content-type']);
      console.log('[MAIN] Body APÓS parse JSON:', JSON.stringify(req.body));
      console.log('[MAIN] Tipo de req.body:', typeof req.body);
      console.log('[MAIN] Tipo de req.body.ids:', typeof req.body?.ids);
      console.log(
        '[MAIN] Array.isArray(req.body.ids):',
        Array.isArray(req.body?.ids),
      );
    }
    next();
  });

  // 3. ValidationPipe com configuração que preserva arrays
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false, // Não remove propriedades não definidas no DTO
      forbidNonWhitelisted: false,
    }),
  );

  app.use((req, res, next) => {
    res.json = (data) => {
      return res.send(stringify(data));
    };
    next();
  });
  const port = process.env.PORT || 3000;
  app.enableCors({ origin: 'http://localhost:3001' });
  const options = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Atendimento ao Público - Agendamentos')
    .setDescription(
      'Backend em NestJS para aplicação de agendamento de Atendimentos ao Público.',
    )
    .setVersion('versão 1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('', app, document);
  await app.listen(port);
  console.log('API outorga rodando em http://localhost:' + port);
  console.log('SwaggerUI rodando em http://localhost:' + port + '/api');
}
bootstrap();
