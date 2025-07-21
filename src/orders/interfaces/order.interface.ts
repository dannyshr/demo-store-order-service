// src/orders/interfaces/order.interface.ts
import { ApiProperty } from '@nestjs/swagger';
import { CreateOrderDto } from '../dto/create-order.dto';
import { IsArray, IsEmail, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export interface Order extends CreateOrderDto {
  id: string; // The unique Elasticsearch document ID
}

// DTO for filtering orders (contains optional fields used for query)
export class OrderFilterDto {
  @ApiProperty({ description: 'The ID of the order to filter by', required: false })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Customer full name to filter orders', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Order status to filter orders', required: false })
  @IsString()
  @IsOptional()
  email?: string;
}

// DTO for the partial update data (all fields are optional, as it's a partial update)
export class CustomerUpdateDto {
  @ApiProperty({ description: 'The full name of the customer', example: 'גילה כהן' })
  @IsString()
  @IsOptional()
  fullName: string;

  @ApiProperty({ description: 'The full address of the customer', example: 'רחוב הרצל 10, תל אביב' })
  @IsString()
  @IsOptional()
  fullAddress: string;

  @ApiProperty({ description: 'The email address of the customer', example: 'gila.cohen@example.com' })
  @IsEmail()
  @IsOptional()
  email: string;
}

// DTO for the partial update data (all fields are optional, as it's a partial update)
export class ProductUpdateDto {
  @ApiProperty({ description: 'New product category', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'New product name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'New product quantity', required: false })
  @IsNumber()
  @IsOptional()
  quantity?: number;
}

// DTO for the partial update data (all fields are optional, as it's a partial update)
export class OrderUpdateDto {
  @ApiProperty({ description: 'Customer details for the order' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerUpdateDto)
  customer: CustomerUpdateDto;

  @ApiProperty({ type: [ProductUpdateDto], description: 'List of products in the order' })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductUpdateDto)
  products: ProductUpdateDto[];
}

// DTO for the entire request body for updating orders by filter
export class UpdateOrderRequestDto {
  @ApiProperty({
    description: 'Filter criteria to select orders for update. If empty, all orders will be updated (use with caution!).',
    type: OrderFilterDto,
  })
  @ValidateNested()
  @Type(() => OrderFilterDto)
  filter: OrderFilterDto;

  @ApiProperty({
    description: 'Data to update in the matched orders.',
    type: OrderUpdateDto,
  })
  @ValidateNested()
  @Type(() => OrderUpdateDto)
  order: OrderUpdateDto;
}