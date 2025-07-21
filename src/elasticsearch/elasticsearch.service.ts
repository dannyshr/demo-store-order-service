// src/elasticsearch/elasticsearch.service.ts

import { Injectable, OnModuleInit, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { KeyVaultConfigService } from '../config/keyvault.config';
import { GetResponse, SearchResponse, UpdateByQueryRequest, DeleteByQueryRequest, QueryDslQueryContainer, Script } from '@elastic/elasticsearch/lib/api/types';
import { plainToInstance } from 'class-transformer';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private esClient: Client;
  private INVALID_NUMBER = -1;
  private initialized = false;

  constructor(private readonly configService: ConfigService, private readonly keyVaultConfigService: KeyVaultConfigService) {
    // log the environment variables from the 'configService' object
    this.logger.log('ElasticsearchService(): Start logging environment variables ****');
    this.logger.log(`NODE_ENV: ${this.configService.get('NODE_ENV')}`);
    this.logger.log(`KEY_VAULT_URI=[${this.configService.get('KEY_VAULT_URI')}] (from ConfigService)`);
    this.logger.log('ElasticsearchService(): End logging environment variables ****');
  }

  async onModuleInit() {
    let methodName = 'onModuleInit():';
    this.logger.log(`${methodName} started`);

    //fetch elastic search url and api key from key vault
    let kvKeyElasticUrl = this.configService.get('KEY_VAULT_KEY_ELASTICSEARCH_URL');
    let kvKeyElasticApiKey = this.configService.get('KEY_VAULT_KEY_ELASTICSEARCH_API_KEY');
    let node = await this.keyVaultConfigService.getSecret(kvKeyElasticUrl) || '';
    let apiKey = await this.keyVaultConfigService.getSecret(kvKeyElasticApiKey) || '';
    const clientOptions = {
      node: node,
      auth: apiKey ? { apiKey: apiKey } : undefined,
    };

    //check for valid values
    if (!node || node.trim()==='') {
      const errorMessage = `${methodName} ${kvKeyElasticUrl} is empty or null !!`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (!apiKey || apiKey.trim()==='') {
      const errorMessage = `${methodName} ${kvKeyElasticApiKey} is empty or null !!`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    //set the elasticsearch client and check the index
    this.esClient = new Client(clientOptions);
    this.initialized = true;
    this.logger.log(`${methodName} finished`);
  }

  private async loadMappings(indexName: string, fileName: string) {
    let methodName = "loadMappings():";
    let message = "";

    //check for valid values
    if (!indexName || indexName.trim()==='') {
      message = 'indexName is empty or null !!';
      this.logger.log(`${methodName} ${message}`);
      throw new Error(`${message}`);
    }
    if (!fileName || fileName.trim()==='') {
      message = 'fileName is empty or null !!';
      this.logger.log(`${methodName} ${message}`);
      throw new Error(`${message}`);
    }

    try {
      const mappingFilePath = path.join(__dirname, '..', 'mappings', fileName);
      this.logger.log(`${methodName} Attempting to load mapping from: ${mappingFilePath}`);

      const fileContent = await fs.readFile(mappingFilePath, 'utf8');
      let fileMappings = JSON.parse(fileContent);
      return fileMappings;
    } 
    catch (error) {
      message = `Failed to load mappings file from ${fileName}`
      this.logger.log(`${methodName} ${message}`);
      throw new Error(`${message}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async createIndex(indexName: string, mappingsFile: string) {
    let methodName = "createIndex():";
    let message = "";

    //check for valid values
    if (!indexName || indexName.trim()==='') {
      message = 'indexName is empty or null !!';
      this.logger.log(`${methodName} ${message}`);
      throw new Error(`${message}`);
    }
    if (!mappingsFile || mappingsFile.trim()==='') {
      message = 'mappingsFile is empty or null !!';
      this.logger.log(`${methodName} ${message}`);
      throw new Error(`${message}`);
    }

    try {
      const _mappings = await this.loadMappings(indexName, mappingsFile);
      const indexExists = await this.esClient.indices.exists({ index: indexName });

      if (!indexExists) {
        this.logger.log(`${methodName} Index '${indexName}' does not exist. Creating it with mappings...`);
        await this.esClient.indices.create({
          index: indexName,
          mappings: _mappings,
        });
        this.logger.log(`${methodName} Index '${indexName}' created successfully.`);
      } 
      else {
        this.logger.log(`${methodName} Index '${indexName}' already exists.`);
      }
    } 
    catch (error) {
      this.logger.error(`${methodName} Error checking or creating index '${indexName}' !! Error is: `, error);
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

  /**
   * Recursively flattens an object and builds a Painless script and parameters.
   * This handles nested objects by using dot notation for keys.
   * @param obj The object to flatten.
   * @param scriptLines An array to accumulate script lines.
   * @param params A record to accumulate script parameters.
   * @param prefix The current prefix for nested keys (e.g., 'customer.').
   */
  private flattenObjectAndBuildScript(obj: Record<string, any>, scriptLines: string[], params: Record<string, any>, prefix: string = ''): void {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Filter out undefined and null values
      if (value === undefined || value === null) {
        return;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // If it's a nested object, recurse
        this.flattenObjectAndBuildScript(value, scriptLines, params, fullKey);
      } else {
        // If it's a primitive value or array, add to script and params
        // Painless script syntax for setting a field: ctx._source.field = params.paramName;
        // The paramName needs to be unique, so we use the flattened key (e.g., 'customer_email')
        const paramName = fullKey.replace(/\./g, '_'); // Replace dots with underscores for param name safety
        scriptLines.push(`ctx._source.${fullKey} = params.${paramName};`);
        params[paramName] = value;
      }
    });
  }

  /**
   * Generic method to update one or more documents in Elasticsearch by a given filter.
   * @template F The type of the filter object.
   * @template U The type of the update data object.
   * @template T The type of the objects fetched by the filter.
   * @param filter An object whose properties will be used to build the Elasticsearch query.
   * Example: `{ name: 'John Doe', status: 'active' }`
   * If empty, it will match all documents (use with caution!).
   * @param updateData An object containing the fields and their new values to update in the matched documents.
   * Example: `{ address: '123 Main St', age: 30 }`
   * @param indexName The name of the Elasticsearch index to perform the update on.
   * @returns A Promise that resolves to the number of updated docuemnts, or -1 if none were updated, or ig something went wrong.
   * @throws BadRequestException if required inputs are empty or null.
   * @throws InternalServerErrorException if an Elasticsearch operation fails.
   */
  async updateByFilter<F extends Record<string, any>, U extends Record<string, any>>(filter: F, updateData: U, indexName: string): Promise<number> {
    const methodName = "updateByFilter(): ";

    // Input validation for indexName
    if (!indexName || indexName.trim() === '') {
      this.logger.error(`${methodName} indexName is empty or null !!`);
      throw new BadRequestException('Elasticsearch index name cannot be empty or null.');
    }

    // Input validation for updateData
    if (!updateData || Object.keys(updateData).length === 0) {
      this.logger.error(`${methodName} updateData is empty or null !!`);
      throw new BadRequestException('Update data cannot be empty or null.');
    }

    // --- 1. Construct the Elasticsearch query based on the filter object ---
    let esQuery: QueryDslQueryContainer; // Explicitly typed
    if (!filter || Object.keys(filter).length === 0) {
      this.logger.warn(`${methodName} No filter provided !!`);
      return this.INVALID_NUMBER;
    }

    const queryParts: QueryDslQueryContainer[] = [];

    // Check for 'id' property in the filter, which corresponds to Elasticsearch's _id
    const filterId = filter['id'];
    if (filterId !== undefined && filterId !== null && typeof filterId === 'string' && filterId.trim() !== '') {
      queryParts.push({ ids: { values: [filterId] } });
    }

    // Process other filter properties (excluding 'id')
    const otherFilterEntries = Object.entries(filter)
      .filter(([key, value]) => key !== 'id' && value !== undefined && value !== null);

    if (otherFilterEntries.length > 0) {
      const mustClausesForOtherFields = otherFilterEntries.map(([key, value]) => ({
        term: { [key]: value },
      }));
      queryParts.push(...mustClausesForOtherFields);
    }

    // Determine the final esQuery
    if (queryParts.length === 0) {
      this.logger.error(`${methodName} Provided filter fields are all empty !!`);
      throw new BadRequestException('Provided filter fields are all empty !!');
    } 
    if (queryParts.length === 1) {
      esQuery = queryParts[0];
    } 
    else {
      esQuery = {
        bool: {
          must: queryParts,
        },
      };
    }

    // --- 2. Construct the Painless script and its parameters from updateData ---
    const scriptLines: string[] = [];
    const scriptParams: Record<string, any> = {};

    // Use the new helper to flatten updateData and build the script
    this.flattenObjectAndBuildScript(updateData, scriptLines, scriptParams);

    if (scriptLines.length === 0) {
      this.logger.error(`${methodName} updateData object became empty after filtering out undefined/null values or contained no updatable fields.`);
      throw new BadRequestException('Update data contains no valid fields to update after processing.');
    }

    const esScript: Script = {
      source: scriptLines.join(' '), // Join script lines with a space
      params: scriptParams,
    };

    try {
      // --- 3. Build the ENTIRE request parameters for updateByQuery ---
      const params: UpdateByQueryRequest = {
        index: indexName,
        body: {
          query: esQuery,
          script: esScript,
        } as unknown as UpdateByQueryRequest['body'],
        refresh: true,
      };

      // --- 4. Perform the Elasticsearch updateByQuery operation ---
      const response = await this.esClient.updateByQuery(params);

      // --- 5. Check if any documents were updated and return boolean ---
      if (!response) {
        this.logger.warn(`${methodName} Response is empty from Elasticsearch for index [${indexName}] matching filter: ${JSON.stringify(filter)}.`);
        return this.INVALID_NUMBER;
      }
      if (!response.updated) {
        this.logger.warn(`${methodName} Response.updated is empty from Elasticsearch for index [${indexName}] matching filter: ${JSON.stringify(filter)}.`);
        return this.INVALID_NUMBER;
      }

      let result = response.updated;
      this.logger.log(`${methodName} Successfully updated ${response.updated} documents in index [${indexName}] matching filter: ${JSON.stringify(filter)}.`);
      return result;
    }
    catch (error) {
      // --- Error Handling ---
      this.logger.error(
        `${methodName} Error updating documents in Elasticsearch index [${indexName}] by filter: ${JSON.stringify(filter)} !! Error is: `,
        error.stack || error.message,
      );
      throw new InternalServerErrorException(`Failed to update documents in index [${indexName}] by filter: ${error.message}`,
      );
    }
  }

  /**
   * Generic method to delete one or more documents in Elasticsearch by a given filter.
   * @template F The type of the filter object.
   * @param filter An object whose properties will be used to build the Elasticsearch query.
   * Example: `{ name: 'John Doe', status: 'active' }`
   * If empty, it will match all documents (use with caution!).
   * @param indexName The name of the Elasticsearch index to perform the update on.
   * @returns A Promise that resolves to the number of deleted docuemnts, or -1 if none were deleted, or ig something went wrong.
   * @throws BadRequestException if required inputs are empty or null.
   * @throws InternalServerErrorException if an Elasticsearch operation fails.
   */
  async deleteByFilter<F extends Record<string, any>>(filter: F, indexName: string): Promise<number> {
    const methodName = "deleteByFilter(): ";

    // Input validation for indexName
    if (!indexName || indexName.trim() === '') {
      this.logger.error(`${methodName} indexName is empty or null !!`);
      throw new BadRequestException('Elasticsearch index name cannot be empty or null.');
    }

    // --- 1. Construct the Elasticsearch query based on the filter object ---
    let esQuery: QueryDslQueryContainer; // Explicitly typed
    if (!filter || Object.keys(filter).length === 0) {
      this.logger.warn(`${methodName} No filter provided !!`);
      return this.INVALID_NUMBER;
    }

    const queryParts: QueryDslQueryContainer[] = [];

    // Check for 'id' property in the filter, which corresponds to Elasticsearch's _id
    const filterId = filter['id'];
    if (filterId !== undefined && filterId !== null && typeof filterId === 'string' && filterId.trim() !== '') {
      queryParts.push({ ids: { values: [filterId] } });
    }

    // Process other filter properties (excluding 'id')
    const otherFilterEntries = Object.entries(filter)
      .filter(([key, value]) => key !== 'id' && value !== undefined && value !== null);

    if (otherFilterEntries.length > 0) {
      const mustClausesForOtherFields = otherFilterEntries.map(([key, value]) => ({
        term: { [key]: value },
      }));
      queryParts.push(...mustClausesForOtherFields);
    }

    // Determine the final esQuery
    if (queryParts.length === 0) {
      this.logger.error(`${methodName} Provided filter fields are all empty !!`);
      throw new BadRequestException('Provided filter fields are all empty !!');
    } 
    if (queryParts.length === 1) {
      esQuery = queryParts[0];
    } 
    else {
      esQuery = {
        bool: {
          must: queryParts,
        },
      };
    }

    try {
      // --- 2. Build the ENTIRE request parameters for deleteByQuery ---
      const params: DeleteByQueryRequest = {
        index: indexName,
        query: esQuery,
        refresh: true,
      };

      // --- 3. Perform the Elasticsearch operation ---
      const response = await this.esClient.deleteByQuery(params);

      // --- 4. Check if any documents were affected and return boolean ---
      if (!response) {
        this.logger.warn(`${methodName} Response is empty from Elasticsearch for index [${indexName}] matching filter: ${JSON.stringify(filter)}.`);
        return this.INVALID_NUMBER;
      }
      //this.logger.log(`${methodName} Response is: [${JSON.stringify(response)}]`);
      if (!response.deleted) {
        this.logger.warn(`${methodName} Response.deleted is empty from Elasticsearch for index [${indexName}] matching filter: ${JSON.stringify(filter)}.`);
        return this.INVALID_NUMBER;
      }

      let result = response.deleted;
      this.logger.log(`${methodName} Successfully deleted ${response.deleted} documents in index [${indexName}] matching filter: ${JSON.stringify(filter)}.`);
      return result;
    }
    catch (error) {
      // --- Error Handling ---
      this.logger.error(
        `${methodName} Error deleting documents in Elasticsearch index [${indexName}] by filter: ${JSON.stringify(filter)} !! Error is: `,
        error.stack || error.message,
      );
      throw new InternalServerErrorException(`Failed to delete documents in index [${indexName}] by filter: ${error.message}`,
      );
    }
  }
}
