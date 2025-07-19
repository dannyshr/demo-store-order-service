// src/orders/orders.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './interfaces/order.interface';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private indexName: string;
  private maxResults: number;

  // Inject ElasticsearchService into the OrdersService constructor
  constructor(private readonly configService: ConfigService, private readonly elasticsearchService: ElasticsearchService) {
    this.indexName = configService.get<string>('ELASTICSEARCH_INDEX_NAME') || '';
    this.maxResults = parseInt(configService.get<string>('FETCH_RESULTS_MAX') || '') || 1000;
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    this.logger.log('Order received in service, attempting to index in Elasticsearch...');

    // Call the ElasticsearchService to index the order document
    // We'll use the entire DTO object as the document
    const response = await this.elasticsearchService.indexDocument(this.indexName, createOrderDto);

    // Elasticsearch's index response contains _id (the document ID)
    const orderId = response._id;
    this.logger.log(`Order successfully indexed with ID: ${orderId}`);

    return { id: orderId, ...createOrderDto }; // Return the order with the Elasticsearch ID
  }

  // Method to get all orders, specifically using CreateOrderDto as the return type
  async getAllOrders(): Promise<Order[]> { // Return type is Order[] because Order extends CreateOrderDto and adds 'id'
    // Call the generic method, specifying the index name and the DTO class, and the maxixmum number of results
    const orders = await this.elasticsearchService.getAllItems<CreateOrderDto>(this.indexName, CreateOrderDto, this.maxResults);
    return orders;
  }

  // Method to get a single order by ID, specifically using CreateOrderDto as the return type
  async findOrderById(id: string): Promise<Order | null> {
    // Call the generic method, specifying the index name and the DTO class
    const order = await this.elasticsearchService.getItemById<CreateOrderDto>(id, this.indexName, CreateOrderDto);
    // The type returned by getItemById is (CreateOrderDto & { id: string }) | null,
    // which is compatible with Order | null as Order extends CreateOrderDto and adds 'id'.
    return order;
  }
}
