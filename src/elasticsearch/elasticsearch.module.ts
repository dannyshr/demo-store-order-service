// src/elasticsearch/elasticsearch.module.ts

import { Module } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';

@Module({
  providers: [ElasticsearchService], // Register ElasticsearchService as a provider
  exports: [ElasticsearchService],   // Export it so other modules can use it
})
export class ElasticsearchModule {}
