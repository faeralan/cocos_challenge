import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Order, OrderSide, OrderStatus, OrderType } from '../entities/order.entity';
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
    private readonly dataSource: DataSource,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Validate user exists
      const user = await manager.findOneBy(User, {
        id: dto.userid,
      });
      if (!user) {
        throw new NotFoundException(`User with id ${dto.userid} not found`);
      }

      // Route based on order side
      if (dto.side === OrderSide.CASH_IN || dto.side === OrderSide.CASH_OUT) {
        return this.processCashTransfer(dto, manager);
      } else {
        return this.processMarketOrder(dto, manager);
      }
    });
  }

  private async processMarketOrder(
    dto: CreateOrderDto,
    manager: EntityManager,
  ): Promise<Order> {
    // Validate instrument exists
    if (!dto.instrumentid) {
      throw new BadRequestException('Instrument ID is required for BUY/SELL orders');
    }

    const instrument = await manager.findOneBy(Instrument, {
      id: dto.instrumentid,
    });
    if (!instrument) throw new NotFoundException(`Instrument with id ${dto.instrumentid} not found`);

    // Determine price
    const price = await this.resolveOrderPrice(dto, manager);

    // Resolve size
    const size = this.resolveOrderSize(dto, price);

    const totalOrderValue = size * price;

    // Validate funds/holdings
    if (dto.side === OrderSide.BUY) {
      const availableCash = await this.getAvailableCash(
        dto.userid,
        manager,
      );
      if (totalOrderValue > availableCash) {
        // Insufficient funds - save as REJECTED
        const rejectedOrder = manager.create(Order, {
          userid: dto.userid,
          instrumentid: dto.instrumentid,
          side: dto.side,
          size,
          price,
          type: dto.type as OrderType,
          status: OrderStatus.REJECTED,
          datetime: new Date(),
        });
        return manager.save(rejectedOrder);
      }
    }

    if (dto.side === OrderSide.SELL) {
      //check if the user has enough holdings
      const holding = await this.getInstrumentHolding(
        dto.userid,
        dto.instrumentid,
        manager,
      );
      if (size > holding) {
        // Insufficient holdings - save as REJECTED
        const rejectedOrder = manager.create(Order, {
          userid: dto.userid,
          instrumentid: dto.instrumentid,
          side: dto.side,
          size,
          price,
          type: dto.type as OrderType,
          status: OrderStatus.REJECTED,
          datetime: new Date(),
        });
        return manager.save(rejectedOrder);
      }
    }

    // Determine status
    const status =
      dto.type === OrderType.MARKET ? OrderStatus.FILLED : OrderStatus.NEW;

    // Create and save the order
    const order = manager.create(Order, {
      userid: dto.userid,
      instrumentid: dto.instrumentid,
      side: dto.side,
      size,
      price,
      type: dto.type as OrderType,
      status,
      datetime: new Date(),
    });

    return manager.save(order);
  }

  private async processCashTransfer(
    dto: CreateOrderDto,
    manager: EntityManager,
  ): Promise<Order> {
    // Get cash instrument (MONEDA)
    const cashInstrument = await this.getCashInstrument(manager);

    // Resolve size
    const size = this.resolveOrderSize(dto, 1);

    // For CASH_OUT, validate sufficient funds
    if (dto.side === OrderSide.CASH_OUT) {
      const availableCash = await this.getAvailableCash(
        dto.userid,
        manager,
      );
      if (size > availableCash) {
        // Insufficient funds - save as REJECTED
        const rejectedOrder = manager.create(Order, {
          userid: dto.userid,
          instrumentid: cashInstrument.id,
          side: dto.side,
          size,
          price: 1,
          type: OrderType.MARKET,
          status: OrderStatus.REJECTED,
          date: new Date(),
        });
        return manager.save(rejectedOrder);
      }
    }

    // Cash transfers are immediately FILLED
    const order = manager.create(Order, {
      userid: dto.userid,
      instrumentid: cashInstrument.id,
      side: dto.side,
      size,
      price: 1,
      type: OrderType.MARKET,
      status: OrderStatus.FILLED,
      date: new Date(),
    });

    return manager.save(order);
  }

  async cancelOrder(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findOneBy({ id: orderId });
    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    if (order.status !== OrderStatus.NEW) {
      throw new BadRequestException('Only NEW orders can be cancelled');
    }

    order.status = OrderStatus.CANCELLED;
    return this.orderRepository.save(order);
  }

  /**
   * Validate order type and related constraints
   */
  private validateOrderType(dto: CreateOrderDto): void {
    if (!dto.type) {
      throw new BadRequestException('Type is required for BUY/SELL orders');
    }

    if (dto.type === OrderType.MARKET && dto.price !== undefined) {
      throw new BadRequestException('Price must not be provided for MARKET orders');
    }

    if (dto.type === OrderType.LIMIT && !dto.price) {
      throw new BadRequestException('Price is required for LIMIT orders');
    }
  }

  /**
   * Resolve the price for an order based on its type
   */
  private async resolveOrderPrice(
    dto: CreateOrderDto,
    manager: EntityManager,
  ): Promise<number> {
    this.validateOrderType(dto);

    return dto.type === OrderType.LIMIT
      ? dto.price!
      : await this.getLatestPrice(dto.instrumentid!, manager);
  }

  /**
   * Resolve the size (quantity) for an order
   * Supports both direct size specification or amount-based calculation
   */
  private resolveOrderSize(dto: CreateOrderDto, price: number): number {
    if (dto.size) {
      return dto.size;
    }

    if (dto.amount) {
      const calculatedSize = Math.floor(dto.amount / price);
      if (calculatedSize <= 0) {
        throw new BadRequestException(
          'Amount is not enough to buy at least 1 share',
        );
      }
      return calculatedSize;
    }

    throw new BadRequestException(
      'Either size or amount must be provided',
    );
  }

  /**
   * Calculate available cash for a user by summing all FILLED orders
   * availableCash =
      (CASH_IN)
    - (CASH_OUT)
    - (BUY size × price)
    + (SELL size × price)
   */
  private async getAvailableCash(
    userid: number,
    manager: EntityManager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(Order, 'o')
      .select(
        `COALESCE(SUM(
          CASE
            WHEN o.side IN ('CASH_IN', 'SELL') THEN o.size * COALESCE(o.price, 1)
            WHEN o.side IN ('CASH_OUT', 'BUY') THEN -o.size * COALESCE(o.price, 1)
            ELSE 0
          END
        ), 0)`,
        'availableCash',
      )
      .where('o.userid = :userid', { userid })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .getRawOne();

    return Number(result.availableCash);
  }

  /**
   * Calculate instrument holdings for a user by summing BUY/SELL orders
   */
  private async getInstrumentHolding(
    userid: number,
    instrumentid: number,
    manager: EntityManager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(Order, 'o')
      .select(
        `COALESCE(SUM(
          CASE
            WHEN o.side = 'BUY' THEN o.size
            WHEN o.side = 'SELL' THEN -o.size
            ELSE 0
          END
        ), 0)`,
        'holding',
      )
      .where('o.userid = :userid', { userid })
      .andWhere('o.instrumentid = :instrumentid', { instrumentid })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .getRawOne();

    return Number(result.holding);
  }

  /**
   * Get the latest close price for an instrument from market data
   */
  private async getLatestPrice(
    instrumentid: number,
    manager: EntityManager,
  ): Promise<number> {
    const latestMarketData = await manager.findOne(MarketData, {
      where: { instrumentid },
      order: { date: 'DESC' },
    });

    if (!latestMarketData) {
      throw new BadRequestException(
        `No market data available for instrument ${instrumentid}`,
      );
    }

    return Number(latestMarketData.close);
  }

  /**
   * Get the cash instrument (type = MONEDA)
   */
  private async getCashInstrument(
    manager: EntityManager,
  ): Promise<Instrument> {
    const cashInstrument = await manager.findOneBy(Instrument, {
      type: 'MONEDA',
    });

    if (!cashInstrument) {
      throw new BadRequestException(
        'Cash instrument (MONEDA) not found in database',
      );
    }

    return cashInstrument;
  }
}
