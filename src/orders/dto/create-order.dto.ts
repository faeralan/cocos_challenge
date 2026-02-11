import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { OrderSide, OrderType } from '../../entities/order.entity';

/**
 * Only validates format and type - business rules validated in service
 */
export class CreateOrderDto {
  @ApiProperty({ example: 1, description: 'User ID placing the order' })
  @IsInt()
  @IsPositive()
  userid: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Instrument ID (required for BUY/SELL, must NOT be provided for CASH_IN/CASH_OUT)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  instrumentid?: number;

  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of shares (mutually exclusive with amount)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number;

  @ApiPropertyOptional({
    example: 5000.0,
    description: 'Total amount in ARS (mutually exclusive with size)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    enum: OrderType,
    example: OrderType.MARKET,
    description: 'Order type (required for BUY/SELL, must NOT be provided for CASH_IN/CASH_OUT)',
  })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiPropertyOptional({
    example: 150.5,
    description: 'Price per share (required for LIMIT, must NOT be provided for MARKET or CASH transfers)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;
}
