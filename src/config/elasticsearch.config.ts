// src/config/elasticsearch.config.ts

import { ClientOptions } from '@elastic/elasticsearch';
// *** FIX: Import ConfigService from @nestjs/config ***
import { ConfigService } from '@nestjs/config';

export const ORDERS_INDEX = 'orders';

// This function will now take the ConfigService as an argument
// and retrieve the environment variables through it.
// *** FIX: Type configService as ConfigService ***
export const getElasticsearchConfig = (configService: ConfigService): ClientOptions => {
  const node = configService.get<string>('ELASTICSEARCH_URL') || 'ELASTICSEARCH_URL is NOT deefined';
  const apiKey = configService.get<string>('ELASTICSEARCH_API_KEY');

  return {
    node: node,
    auth: apiKey ? { apiKey: apiKey } : undefined,
  };
};
