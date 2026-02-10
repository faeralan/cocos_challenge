import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from '../entities/order.entity';
import { Instrument } from '../entities/instrument.entity';
import { MarketData } from '../entities/market-data.entity';
import { User } from '../entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Instrument)
    private readonly instrumentRepository: Repository<Instrument>,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // Validate user exists
    const user = await this.userRepository.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} not found`);
    }

    // Validate instrument exists
    const instrument = await this.instrumentRepository.findOneBy({
      id: dto.instrumentId,
    });
    if (!instrument) {
      throw new NotFoundException(
        `Instrument with id ${dto.instrumentId} not found`,
      );
    }

    // Determine price
    let price = dto.price;

    if (dto.type === OrderType.MARKET) {
      // For MARKET orders, get the latest close price from market data
      const latestMarketData = await this.marketDataRepository.findOne({
        where: { instrumentId: dto.instrumentId },
        order: { datetime: 'DESC' },
      });

      if (!latestMarketData) {
        throw new BadRequestException(
          `No market data available for instrument ${instrument.ticker}`,
        );
      }

      price = Number(latestMarketData.close);
    }

    if (dto.type === OrderType.LIMIT && !dto.price) {
      throw new BadRequestException(
        'Price is required for LIMIT orders',
      );
    }

    // Create and save the order
    const order = this.orderRepository.create({
      userId: dto.userId,
      instrumentId: dto.instrumentId,
      side: dto.side,
      size: dto.size,
      price,
      type: dto.type,
      status: OrderStatus.NEW,
      datetime: new Date(),
    });

    return this.orderRepository.save(order);
  }
}
