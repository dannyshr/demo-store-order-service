// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Removed: import { AppController } from './app.controller';
// Removed: import { AppService } from './app.service';
import { OrdersModule } from './orders/orders.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`env/.env.${process.env.NODE_ENV}`, 'env/.env'],
      ignoreEnvFile: false,
    }),
    OrdersModule,
    ElasticsearchModule
  ],
  controllers: [], // Now empty
  providers: [],   // Now empty
})
export class AppModule {}
