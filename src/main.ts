import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { stringify } from 'json-bigint';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Parse do JSON/URL-encoded
  app.use(json({ limit: '250mb' }));
  app.use(urlencoded({ extended: true, limit: '250mb' }));

  // ValidationPipe com configuração que preserva arrays
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  app.use((_, res, next) => {
    res.json = (data) => {
      return res.send(stringify(data));
    };
    next();
  });
  const port = process.env.PORT || 3000;
  const frontendPort = process.env.FRONTEND_PORT || 3001;
  app.enableCors({ origin: `http://localhost:${frontendPort}` });
  const options = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('ANTARES - Backend')
    .setDescription(
      'Backend em NestJS para aplicação gestão de processos - ANTARES.',
    )
    .setVersion('versão 1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('', app, document);
  await app.listen(port);
}
bootstrap();
