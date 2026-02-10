import { ApiProperty } from '@nestjs/swagger';
import { OrderSide, OrderStatus, OrderType } from '../../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  instrumentId: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  side: OrderSide;

  @ApiProperty({ example: 10 })
  size: number;

  @ApiProperty({ example: 150.5 })
  price: number;

  @ApiProperty({ enum: OrderType, example: OrderType.MARKET })
  type: OrderType;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.NEW })
  status: OrderStatus;

  @ApiProperty()
  datetime: Date;
}
