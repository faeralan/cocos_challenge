import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../../entities/order.entity';

export class CreateOrderDto {
  @ApiProperty({ example: 1, description: 'User ID placing the order' })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiProperty({ example: 1, description: 'Instrument ID' })
  @IsInt()
  @IsPositive()
  instrumentId: number;

  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ example: 10, description: 'Number of shares' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiProperty({ enum: OrderType, example: OrderType.MARKET })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiPropertyOptional({
    example: 150.5,
    description: 'Price per share (required for LIMIT orders)',
  })
  @ValidateIf((o) => o.type === OrderType.LIMIT)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;
}
