import { INestApplication, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'healthz', method: RequestMethod.GET }] });
  if (process.env.NODE_ENV !== 'production') app.enableCors();
  const config = new DocumentBuilder().setTitle('Kimmy Systems API').setDescription('Public sites, published pages, and account auth').setVersion('0.2.0').addBearerAuth().build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  app.enableShutdownHooks();
}
