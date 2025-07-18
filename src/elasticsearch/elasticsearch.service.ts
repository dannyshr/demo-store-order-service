// src/elasticsearch/elasticsearch.service.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { getElasticsearchConfig, ORDERS_INDEX } from '../config/elasticsearch.config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly esClient: Client;
  private readonly logger = new Logger(ElasticsearchService.name);
  private ordersMapping: any;

  constructor(private readonly configService: ConfigService) {
    // *** FIX: Capture the client options object before passing it to the Client constructor ***
    const clientOptions = getElasticsearchConfig(this.configService);
    this.esClient = new Client(clientOptions);

    // Debug logs: Now log the properties from the 'clientOptions' object
    this.logger.log(`NODE_ENV: ${this.configService.get('NODE_ENV')}`);
    this.logger.log(`ELASTICSEARCH_URL (from ConfigService): ${this.configService.get('ELASTICSEARCH_URL')}`);
    this.logger.log(`ELASTICSEARCH_API_KEY (from ConfigService): ${this.configService.get('ELASTICSEARCH_API_KEY')}`);
    this.logger.log(`Final elasticsearchConfig.node: ${clientOptions.node}`); // Log from clientOptions
    // Safely access apiKey from clientOptions.auth
    if (clientOptions.auth && 'apiKey' in clientOptions.auth) {
      this.logger.log(`Final elasticsearchConfig.auth.apiKey: ${clientOptions.auth.apiKey}`);
    } else if (clientOptions.auth) {
      this.logger.log(`Final elasticsearchConfig.auth: (Auth object present, but no apiKey property)`);
    } else {
      this.logger.log(`Final elasticsearchConfig.auth: (No auth object)`);
    }
  }

  async onModuleInit() {
    await this.loadOrdersMapping();
    await this.checkAndCreateIndex();
  }

  private async loadOrdersMapping() {
    try {
      const mappingFilePath = path.join(__dirname, '..', 'mappings', 'orders.mapping.json');
      this.logger.log(`Attempting to load mapping from: ${mappingFilePath}`);

      const fileContent = await fs.readFile(mappingFilePath, 'utf8');
      this.ordersMapping = JSON.parse(fileContent);
      this.logger.log('Orders mapping loaded successfully from file.');
    } catch (error) {
      this.logger.error('Failed to load orders mapping from file:', error);
      throw new Error('Failed to initialize ElasticsearchService: Could not load orders mapping.');
    }
  }

  private async checkAndCreateIndex() {
    try {
      const indexExists = await this.esClient.indices.exists({ index: ORDERS_INDEX });

      if (!indexExists) {
        this.logger.log(`Index '${ORDERS_INDEX}' does not exist. Creating it with mapping...`);
        await this.esClient.indices.create({
          index: ORDERS_INDEX,
          mappings: this.ordersMapping,
        });
        this.logger.log(`Index '${ORDERS_INDEX}' created successfully.`);
      } else {
        this.logger.log(`Index '${ORDERS_INDEX}' already exists.`);
      }
    } catch (error) {
      this.logger.error(`Error checking or creating index '${ORDERS_INDEX}':`, error);
      throw error;
    }
  }

  async indexDocument(document: any) {
    try {
      const response = await this.esClient.index({
        index: ORDERS_INDEX,
        document: document,
      });
      this.logger.log(`Document indexed successfully: ${JSON.stringify(response.result)}`);
      return response;
    } catch (error) {
      this.logger.error(`Error indexing document:`, error);
      throw error;
    }
  }
}
