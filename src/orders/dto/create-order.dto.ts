import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { OrderSide, OrderType } from '../../entities/order.entity';

// Custom validator to ensure exactly one of size or amount is provided
function IsExactlyOneOf(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isExactlyOneOf',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          const hasThis = value !== undefined && value !== null;
          const hasRelated =
            relatedValue !== undefined && relatedValue !== null;
          return hasThis !== hasRelated; // XOR: exactly one must be present
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `Exactly one of ${args.property} or ${relatedPropertyName} must be provided`;
        },
      },
    });
  };
}

export class CreateOrderDto {
  @ApiProperty({ example: 1, description: 'User ID placing the order' })
  @IsInt()
  @IsPositive()
  userid: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Instrument ID (required for BUY/SELL, auto-resolved for CASH_IN/CASH_OUT)',
  })
  @ValidateIf(
    (o) => o.side === OrderSide.BUY || o.side === OrderSide.SELL,
  )
  @IsInt()
  @IsPositive()
  instrumentid?: number;

  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Number of shares (mutually exclusive with amount - provide exactly one)',
  })
  @IsExactlyOneOf('amount', {
    message: 'Exactly one of size or amount must be provided',
  })
  @ValidateIf((o) => o.size !== undefined && o.size !== null)
  @IsInt()
  @Min(1)
  size?: number;

  @ApiPropertyOptional({
    example: 1500.0,
    description:
      'Total investment in ARS (mutually exclusive with size - provide exactly one)',
  })
  @ValidateIf((o) => o.amount !== undefined && o.amount !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    enum: OrderType,
    example: OrderType.MARKET,
    description: 'Order type (required for BUY/SELL)',
  })
  @ValidateIf(
    (o) => o.side === OrderSide.BUY || o.side === OrderSide.SELL,
  )
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiPropertyOptional({
    example: 150.5,
    description: 'Price per share (required ONLY for LIMIT orders, must NOT be provided for MARKET orders)',
  })
  @ValidateIf((o) => o.type === OrderType.LIMIT || o.price !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;
}
