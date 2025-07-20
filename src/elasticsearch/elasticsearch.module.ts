// src/elasticsearch/elasticsearch.module.ts

import { Module } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { ConfigModule } from '@nestjs/config';
import { KeyVaultConfigService } from '../config/keyvault.config';

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    ElasticsearchService,
    KeyVaultConfigService
  ],
  exports: [ElasticsearchService],
})export class ElasticsearchModule {}
