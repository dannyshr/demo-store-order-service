// src/orders/interfaces/order.interface.ts
import { CreateOrderDto } from '../dto/create-order.dto';

export interface Order extends CreateOrderDto {
  id: string; // The unique Elasticsearch document ID
}