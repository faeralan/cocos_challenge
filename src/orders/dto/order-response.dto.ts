import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderSide, OrderStatus, OrderType } from '../../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  instrumentid: number;

  @ApiProperty({ example: 1 })
  userid: number;

  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  side: OrderSide;

  @ApiProperty({ example: 10 })
  size: number;

  @ApiProperty({ example: 150.5 })
  price: number;

  @ApiPropertyOptional({ 
    enum: OrderType, 
    example: OrderType.MARKET,
    description: 'Order type (null for CASH_IN/CASH_OUT transfers)'
  })
  type?: OrderType;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.NEW })
  status: OrderStatus;

  @ApiProperty({ example: '2024-01-01T12:00:00Z' })
  datetime: Date;
}
