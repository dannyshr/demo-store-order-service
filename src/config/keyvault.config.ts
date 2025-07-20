// src/config/keyvault.config.ts
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeyVaultConfigService {
  private readonly logger = new Logger(KeyVaultConfigService.name);
  private secretClient: SecretClient;
  private secretsCache: Map<string, string> = new Map();

  constructor(private configService: ConfigService) {
    const keyVaultUri = this.configService.get<string>('KEY_VAULT_URI');
    if (!keyVaultUri) {
      this.logger.error('KEY_VAULT_URI environment variable is not set. Key Vault integration disabled.');
      return;
    }
    this.secretClient = new SecretClient(keyVaultUri, new DefaultAzureCredential());
    this.logger.log(`KeyVaultConfigService initialized with URI: ${keyVaultUri}`);
  }

  async getSecret(secretName: string): Promise<string | undefined> {
    if (this.secretsCache.has(secretName)) {
      return this.secretsCache.get(secretName);
    }

    try {
      this.logger.debug(`Attempting to retrieve secret: ${secretName}`);
      const secret = await this.secretClient.getSecret(secretName);
      if (secret?.value) {
        this.secretsCache.set(secretName, secret.value);
        this.logger.log(`Successfully retrieved secret: ${secretName}`);
        return secret.value;
      }
      this.logger.warn(`Secret [${secretName}] found but has no value.`);
      return undefined;
    } 
    catch (error) {
      this.logger.error(`Failed to retrieve secret [${secretName}] from Key Vault: ${error.message}`);
      return undefined;
    }
  }
}
