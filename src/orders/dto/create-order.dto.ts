// src/orders/dto/create-order.dto.ts

// Import validation decorators from class-validator
import { IsString, IsEmail, IsNotEmpty, IsInt, IsArray, ValidateNested, Min, IsISO8601 } from 'class-validator';
// Import transformation decorator from class-transformer
import { Type } from 'class-transformer';
// Import Swagger decorators for API documentation (optional, but good practice)
import { ApiProperty } from '@nestjs/swagger';

// Defines the structure for a single product item within an order
export class ProductItemDto {
  @ApiProperty({ description: 'The category of the product', example: 'חלב וגבינות' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'The name of the product', example: 'חלב 3% 1 ליטר' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The quantity of the product', example: 2 })
  @IsInt()
  @Min(1) // Quantity must be at least 1
  quantity: number;
}

// Defines the structure for customer details
export class CustomerDto {
  @ApiProperty({ description: 'The full name of the customer', example: 'גילה כהן' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'The full address of the customer', example: 'רחוב הרצל 10, תל אביב' })
  @IsString()
  @IsNotEmpty()
  fullAddress: string;

  @ApiProperty({ description: 'The email address of the customer', example: 'gila.cohen@example.com' })
  @IsEmail() // Validates if it's a valid email format
  @IsNotEmpty()
  email: string;
}

// Defines the main structure for creating a new order
export class CreateOrderDto {
  @ApiProperty({ description: 'Customer details for the order' })
  @ValidateNested() // Ensures nested object (CustomerDto) is also validated
  @Type(() => CustomerDto) // Specifies the type for transformation
  customer: CustomerDto;

  @ApiProperty({ type: [ProductItemDto], description: 'List of products in the order' })
  @IsArray() // Must be an array
  @ValidateNested({ each: true }) // Validates each item in the array
  @Type(() => ProductItemDto) // Specifies the type for transformation for each item
  products: ProductItemDto[];

  @ApiProperty({ description: 'ISO 8601 formatted date and time of the order', example: '2025-07-17T12:30:00.000Z' })
  @IsISO8601() // Validates if it's an ISO 8601 date string
  @IsNotEmpty()
  orderDate: string; // Using string to match Date.toISOString() from frontend
}
