// src/elasticsearch/elasticsearch.service.ts

import { Injectable, OnModuleInit, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { getElasticsearchConfig } from '../config/elasticsearch.config';
import { GetResponse, SearchResponse } from '@elastic/elasticsearch/lib/api/types';
import { plainToInstance } from 'class-transformer';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly esClient: Client;
  private readonly logger = new Logger(ElasticsearchService.name);
  private ordersMapping: any;
  private indexName: string;

  constructor(private readonly configService: ConfigService) {
    // get the client options object before passing it to the Client constructor
    const clientOptions = getElasticsearchConfig(this.configService);
    this.esClient = new Client(clientOptions);
    this.indexName = configService.get<string>('ELASTICSEARCH_INDEX_NAME') || '';

    // log the properties from the 'clientOptions' object
    this.logger.log(`NODE_ENV: ${this.configService.get('NODE_ENV')}`);
    this.logger.log(`ELASTICSEARCH_URL (from ConfigService): ${this.configService.get('ELASTICSEARCH_URL')}`);
    this.logger.log(`ELASTICSEARCH_API_KEY (from ConfigService): ${this.configService.get('ELASTICSEARCH_API_KEY')}`);
    this.logger.log('ELASTICSEARCH_INDEX_NAME (from ConfigService): ', this.indexName);
    this.logger.log(`Final elasticsearchConfig.node: ${clientOptions.node}`); // Log from clientOptions
    
    // Safely access apiKey from clientOptions.auth
    if (!this.indexName) {
      this.logger.error('indexName is empty or null !!');
    }
    if (clientOptions.auth && 'apiKey' in clientOptions.auth) {
      this.logger.log(`Final elasticsearchConfig.auth.apiKey: ${clientOptions.auth.apiKey}`);
    } 
    else if (clientOptions.auth) {
      this.logger.log(`Final elasticsearchConfig.auth: (Auth object present, but no apiKey property)`);
    } 
    else {
      this.logger.log(`Final elasticsearchConfig.auth: (No auth object)`);
    }
  }

  async onModuleInit() {
    await this.loadOrdersMapping();
    await this.checkAndCreateIndex(this.indexName);
  }

  private async loadOrdersMapping() {
    try {
      const mappingFilePath = path.join(__dirname, '..', 'mappings', 'orders.mapping.json');
      this.logger.log(`Attempting to load mapping from: ${mappingFilePath}`);

      const fileContent = await fs.readFile(mappingFilePath, 'utf8');
      this.ordersMapping = JSON.parse(fileContent);
      this.logger.log('Orders mapping loaded successfully from file.');
    } 
    catch (error) {
      this.logger.error('Failed to load orders mapping from file:', error);
      throw new Error('Failed to initialize ElasticsearchService: Could not load orders mapping.');
    }
  }

  private async checkAndCreateIndex(indexName: string) {
    //check for valid values
    if (!indexName || indexName.trim() === '') {
      this.logger.error('indexName is empty or null !!');
      throw new InternalServerErrorException('Index name cannot be empty or null. Please check if it exists as an environment variable, and it has a non-empty value');    
    }
    try {
      const indexExists = await this.esClient.indices.exists({ index: indexName });

      if (!indexExists) {
        this.logger.log(`Index '${indexName}' does not exist. Creating it with mapping...`);
        await this.esClient.indices.create({
          index: indexName,
          mappings: this.ordersMapping,
        });
        this.logger.log(`Index '${indexName}' created successfully.`);
      } 
      else {
        this.logger.log(`Index '${indexName}' already exists.`);
      }
    } 
    catch (error) {
      this.logger.error(`Error checking or creating index '${indexName}':`, error);
      throw error;
    }
  }

  async indexDocument(indexName: string, document: any) {
    try {
      const response = await this.esClient.index({
        index: indexName,
        document: document,
      });
      this.logger.log(`Document indexed successfully: ${JSON.stringify(response.result)}`);
      return response;
    } 
    catch (error) {
      this.logger.error(`Error indexing document:`, error);
      throw error;
    }
  }

  /**
   * Fetches all documents from a specified Elasticsearch index and converts them
   * into an array of instances of the provided DTO type.
   * @param indexName The name of the Elasticsearch index to query.
   * @param returnType The constructor function (class/DTO) to which each document's _source should be transformed.
   * @param size The maximum number of documents to return. Default is 1000.
   * @returns A promise that resolves to an array of transformed DTO instances, each including the Elasticsearch _id.
   */
  async getAllItems<T>(indexName: string, returnType: new () => T, size: number = 1000): Promise<Array<T & { id: string }>> {
    const methodName = "getAllItems(): ";
    // Input validation for indexName
    if (!indexName || indexName.trim() === '') {
      this.logger.error(`${methodName} indexName is empty or null !!`);
      throw new BadRequestException('Elasticsearch index name cannot be empty or null !!');
    }

    try {
      // Perform the Elasticsearch search.
      // We hint the SearchResponse with 'T' for the _source type.
      const response: SearchResponse<T> = await this.esClient.search<T>({
        index: indexName,
        size: size,
        query: {
          match_all: {},
        },
      });

      // Map Elasticsearch hits to instances of the provided returnType DTO
      const items: Array<T & { id: string }> = response.hits.hits.map(hit => {
        // Use plainToInstance to convert the _source object into an instance of the specified DTO.
        // This leverages @Type and @ValidateNested decorators in your DTOs.
        const dtoInstance = plainToInstance(returnType, hit._source);

        // Create the final object, adding the Elasticsearch _id and spreading the DTO properties.
        // We ensure 'id' is always a string, even if _id is null/undefined (though it shouldn't be for existing docs).
        const itemWithId: T & { id: string } = {
          id: hit._id || '', // Elasticsearch _id is guaranteed for hits
          ...dtoInstance, // Spread the properties from the converted DTO instance
        };
        return itemWithId;
      });

      this.logger.log(`${methodName} Fetched ${items.length} items from Elasticsearch index [${indexName}].`);
      return items;
    } 
    catch (error) {
      this.logger.error(`${methodName} Error fetching items from Elasticsearch index [${indexName}] !! Error is: `, error.stack || error.message);
      // Re-throw a more generic InternalServerErrorException for Elasticsearch issues
      throw new InternalServerErrorException(`Failed to fetch items from index "${indexName}": ${error.message}`);
    }
  }
  
  /**
   * Fetches a single document by ID from a specified Elasticsearch index
   * and converts it into an instance of the provided DTO type.
   * @param id The ID of the document to retrieve.
   * @param indexName The name of the Elasticsearch index (e.g., 'orders').
   * @param returnType The constructor function (class/DTO) to which the document's _source should be transformed.
   * @returns A promise that resolves to a transformed DTO instance (including the Elasticsearch _id)
   * or null if the document is not found.
   */
  async getItemById<T>(id: string, indexName: string, returnType: new () => T): Promise<(T & { id: string }) | null> {
    const methodName = "getItemById(): ";
    // Input validation for id
    if (!id || id.trim() === '') {
      this.logger.error(`${methodName} id is empty or null !!`);
      throw new BadRequestException('Document ID cannot be empty or null.');
    }
    // Input validation for indexName
    if (!indexName || indexName.trim() === '') {
      this.logger.error(`${methodName} indexName is empty or null !!`);
      throw new BadRequestException('Elasticsearch index name cannot be empty or null.');
    }

    try {
      // Perform the Elasticsearch get operation.
      // We hint the GetResponse with 'T' for the _source type.
      const response: GetResponse<T> = await this.esClient.get<T>({
        index: indexName,
        id: id,
      });

      // If the document is not found, response.found will be false
      if (!response.found) {
        this.logger.warn(`${methodName} Document with ID [${id}] not found in index [${indexName}].`);
        return null;
      }

      // Use plainToInstance to convert the _source object into an instance of the specified DTO.
      const dtoInstance = plainToInstance(returnType, response._source);

      // Create the final object, adding the Elasticsearch _id and spreading the DTO properties.
      const itemWithId: T & { id: string } = {
        id: response._id, // Elasticsearch _id is guaranteed for found documents
        ...dtoInstance,
      };

      this.logger.log(`${methodName} Fetched item with ID [${id}] from index [${indexName}].`);
      return itemWithId;
    } 
    catch (error) {
      // Handle 404 specifically if the client throws an error for not found (though response.found handles this)
      // This catch is primarily for other Elasticsearch client errors (e.g., connection issues)
      if (error.statusCode === 404) {
        this.logger.warn(`${methodName} Document with ID [${id}] not found during API call (status 404).`);
        return null;
      }
      this.logger.error(`${methodName} Error fetching item by ID [${id}] from Elasticsearch index [${indexName}] !! Error is: `, error.stack || error.message);
      throw new InternalServerErrorException(`Failed to fetch item with ID [${id}] from index [${indexName}]: ${error.message}`);
    }
  }
}
