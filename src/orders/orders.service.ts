// src/orders/orders.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service'; // Import ElasticsearchService

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  // Inject ElasticsearchService into the OrdersService constructor
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    this.logger.log('Order received in service, attempting to index in Elasticsearch...');

    // Call the ElasticsearchService to index the order document
    // We'll use the entire DTO object as the document
    const response = await this.elasticsearchService.indexDocument(createOrderDto);

    // Elasticsearch's index response contains _id (the document ID)
    const orderId = response._id;
    this.logger.log(`Order successfully indexed with ID: ${orderId}`);

    return { id: orderId, ...createOrderDto }; // Return the order with the Elasticsearch ID
  }
}
