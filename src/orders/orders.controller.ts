// src/orders/orders.controller.ts

import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe, Get } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto'; // Import your DTO

@Controller('orders') // Base route for this controller will be /orders
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post() // This method will handle POST requests to /orders
  @HttpCode(HttpStatus.CREATED) // Set HTTP status code to 201 Created on success
  // Use ValidationPipe to automatically validate the incoming DTO
  // transform: true ensures the incoming JSON is transformed into an instance of CreateOrderDto
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    // The incoming request body is automatically validated against CreateOrderDto
    // If validation fails, NestJS will automatically return a 400 Bad Request response.

    console.log('Received order from frontend:', createOrderDto);

    // Call the service to handle the business logic (e.g., saving to Elasticsearch)
    const result = await this.ordersService.createOrder(createOrderDto);

    // Return a success response
    return {
      message: 'Order received and processed successfully!',
      orderId: result.id, // Assuming the service returns an ID
      status: 'success',
    };
  }

  @Get() // This method will handle GET requests to /orders
  @HttpCode(HttpStatus.OK) // Set HTTP status code to 200 OK on success
  // Use ValidationPipe to automatically validate the incoming DTO
  // transform: true ensures the incoming JSON is transformed into an instance of CreateOrderDto
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async getOrders() {
    // The incoming request body is automatically validated against CreateOrderDto
    // If validation fails, NestJS will automatically return a 400 Bad Request response.

    console.log('Received getOrders request from frontend');

    // Call the service to handle the business logic (e.g., saving to Elasticsearch)
    const result = await this.ordersService.getAllOrders();

    // Return a success response
    return result;
  }
}
