import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });
  const port = process.env.PORT_API ?? 3001;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/v1`);
}

bootstrap();
