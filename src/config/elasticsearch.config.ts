// src/config/elasticsearch.config.ts

import { ClientOptions } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';

// This function takes the ConfigService as an argument
// and retrieve the environment variables through it.
export const getElasticsearchConfig = (configService: ConfigService): ClientOptions => {
  const node = configService.get<string>('ELASTICSEARCH_URL') || 'ELASTICSEARCH_URL is NOT deefined';
  const apiKey = configService.get<string>('ELASTICSEARCH_API_KEY');

  return {
    node: node,
    auth: apiKey ? { apiKey: apiKey } : undefined,
  };
};
