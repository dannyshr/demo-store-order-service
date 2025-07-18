// src/orders/orders.module.ts

import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module'; // Import ElasticsearchModule

@Module({
  imports: [ElasticsearchModule], // Import ElasticsearchModule here
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
