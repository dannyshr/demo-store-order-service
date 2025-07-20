// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { KeyVaultConfigService } from './config/keyvault.config';

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
  controllers: [],
  providers: [KeyVaultConfigService],
  exports: [KeyVaultConfigService],
})
export class AppModule {}
