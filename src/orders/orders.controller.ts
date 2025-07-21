// src/orders/orders.controller.ts

import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe, Get, Put, Logger, NotFoundException, InternalServerErrorException, Delete } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto'; // Import your DTO
import { OrderFilterDto, UpdateOrderRequestDto } from './interfaces/order.interface';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('orders') // Base route for this controller will be /orders
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);
  private INVALID_NUMBER = -1;

  constructor(private readonly ordersService: OrdersService) {}

  @Post() // This method will handle POST requests to /orders
  @HttpCode(HttpStatus.CREATED) // Set HTTP status code to 201 Created on success
  // Use ValidationPipe to automatically validate the incoming DTO
  // transform: true ensures the incoming JSON is transformed into an instance of CreateOrderDto
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Add a new order record into the orders index' }) // Optional: for Swagger
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    // The incoming request body is automatically validated against CreateOrderDto
    // If validation fails, NestJS will automatically return a 400 Bad Request response.

    this.logger.log('Received order from frontend:', createOrderDto);

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
  @ApiOperation({ summary: 'Returns all the orders in the orders index' }) // Optional: for Swagger
  async getOrders() {
    // The incoming request body is automatically validated against CreateOrderDto
    // If validation fails, NestJS will automatically return a 400 Bad Request response.

    this.logger.log('Received getOrders request from frontend');

    // Call the service to handle the business logic (e.g., saving to Elasticsearch)
    const result = await this.ordersService.getAllOrders();

    // Return a success response
    return result;
  }

  /**
   * Updates one or more orders based on the provided filter criteria and update data.
   * @param updateRequestDto The DTO containing both the filter criteria and the update data.
   * @returns A success message if update was successful, or an error if not found/failed.
   */
  @Put('update-by-filter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update orders based on filter criteria' }) // Optional: for Swagger
  @ApiResponse({ status: 200, description: 'Orders updated successfully.' }) // Optional: for Swagger
  @ApiResponse({ status: 400, description: 'Invalid filter or update data provided.' }) // Optional: for Swagger
  @ApiResponse({ status: 404, description: 'No orders found matching the filter.' }) // Optional: for Swagger
  @ApiResponse({ status: 500, description: 'Internal server error during update.' }) // Optional: for Swagger
  async updateOrdersByFilter(@Body() updateRequestDto: UpdateOrderRequestDto): Promise<{ message: string }> {
    this.logger.log(`Received updateOrdersByFilter request from frontend with params: filter: ${JSON.stringify(updateRequestDto.filter)} , update data: ${JSON.stringify(updateRequestDto.order)}`);

    const { filter, order } = updateRequestDto;

    // invoke the service's method
    const numRecs = await this.ordersService.updateOrder(filter, order);

    if (numRecs === this.INVALID_NUMBER) {
      this.logger.error('Unexpected null response from updateOrder service method.');
      throw new InternalServerErrorException('An unexpected error occurred during order update.');
    } 
    if (numRecs === 0) {
      this.logger.warn('No orders found matching the provided filter, or no update was necessary.');
      throw new NotFoundException('No orders found matching the provided filter, or no update was necessary.');
    } 
    else {
      this.logger.log(`${numRecs} Orders updated successfully.`);
      return { message: `${numRecs} Orders updated successfully.` };
    }
  }

  /**
   * Deletes one or more orders based on the provided filter criteria
   * @param orderFilterDto The DTO containing the filter criteria to find the records to be deleted.
   * @returns A success message if delete was successful, or an error if not found/failed.
   */
  @Delete('delete-by-filter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete orders based on filter criteria' }) // Optional: for Swagger
  @ApiResponse({ status: 200, description: 'Orders Deleted successfully.' }) // Optional: for Swagger
  @ApiResponse({ status: 400, description: 'Invalid filter.' }) // Optional: for Swagger
  @ApiResponse({ status: 404, description: 'No orders found matching the filter.' }) // Optional: for Swagger
  @ApiResponse({ status: 500, description: 'Internal server error during delete.' }) // Optional: for Swagger
  async deleteOrdersByFilter(@Body() orderFilterDto: OrderFilterDto): Promise<{ message: string }> {
    this.logger.log(`Received deleteOrdersByFilter request from frontend with params: filter: ${JSON.stringify(orderFilterDto)}`);

    // invoke the service's method
    const numRecs = await this.ordersService.deleteOrder(orderFilterDto);

    if (numRecs === this.INVALID_NUMBER) {
      this.logger.error('Unexpected response from deleteOrder service method.');
      throw new InternalServerErrorException('An unexpected error occurred during order deletion.');
    } 
    if (numRecs === 0) {
      this.logger.warn('No orders found matching the provided filter.');
      throw new NotFoundException('No orders found matching the provided filter.');
    } 
    else {
      this.logger.log(`${numRecs} Orders deleted successfully.`);
      return { message: `${numRecs} Orders deleted successfully.` };
    }
  }
}
