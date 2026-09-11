import { INestApplication, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'healthz', method: RequestMethod.GET }] });
  if (process.env.NODE_ENV !== 'production') app.enableCors();
  const config = new DocumentBuilder().setTitle('Kimmy Systems API').setDescription('Phase 0: public sites and published pages').setVersion('0.1.0').build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  app.enableShutdownHooks();
}
