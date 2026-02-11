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
import { AccountService } from '../account/account.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly accountService: AccountService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validate business rules for input
      this.validateOrderInput(dto);

      // 2. Validate user exists
      const user = await manager.findOneBy(User, {
        id: dto.userid,
      });
      if (!user) {
        throw new NotFoundException(`User with id ${dto.userid} not found`);
      }

      // 3. Route based on order side
      const isCashTransfer = dto.side === OrderSide.CASH_IN || dto.side === OrderSide.CASH_OUT;

      return isCashTransfer ? this.processCashTransfer(dto, manager) : this.processMarketOrder(dto, manager);
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
      const availableCash = await this.accountService.getAvailableCash(dto.userid, manager);
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
      const holding = await this.accountService.getInstrumentHolding(dto.userid, dto.instrumentid, manager);
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
    const status = dto.type === OrderType.MARKET ? OrderStatus.FILLED : OrderStatus.NEW;

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
      const availableCash = await this.accountService.getAvailableCash(dto.userid, manager);
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
          datetime: new Date(),
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
      datetime: new Date(),
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
   * Main validation method - validates business rules for order input
   */
  private validateOrderInput(dto: CreateOrderDto): void {
    this.validateSizeOrAmount(dto);

    const isCashTransfer = dto.side === OrderSide.CASH_IN || dto.side === OrderSide.CASH_OUT;

    isCashTransfer ? this.validateCashTransferInput(dto) : this.validateMarketOrderInput(dto);
  }

  /**
   * Validate that exactly one of size or amount is provided
   */
  private validateSizeOrAmount(dto: CreateOrderDto): void {
    const hasSize = dto.size !== undefined;
    const hasAmount = dto.amount !== undefined;

    if (hasSize === hasAmount) {
      throw new BadRequestException('Exactly one of size or amount must be provided');
    }
  }

  /**
   * Validate cash transfer input (CASH_IN/CASH_OUT)
   * Only userid, side, and size/amount should be provided
   */
  private validateCashTransferInput(dto: CreateOrderDto): void {
    if (dto.instrumentid !== undefined) {
      throw new BadRequestException('instrumentid must not be provided for cash transfers');
    }
    if (dto.type !== undefined) {
      throw new BadRequestException('type must not be provided for cash transfers');
    }
    if (dto.price !== undefined) {
      throw new BadRequestException('price must not be provided for cash transfers');
    }
  }

  /**
   * Validate market order input (BUY/SELL)
   * Requires instrumentid and type, validates price based on type
   */
  private validateMarketOrderInput(dto: CreateOrderDto): void {
    if (!dto.instrumentid) {
      throw new BadRequestException('instrumentid is required for BUY/SELL orders');
    }
    if (!dto.type) {
      throw new BadRequestException('type is required for BUY/SELL orders');
    }
    if (dto.type === OrderType.MARKET && dto.price !== undefined) {
      throw new BadRequestException('price must not be provided for MARKET orders');
    }
    if (dto.type === OrderType.LIMIT && dto.price === undefined) {
      throw new BadRequestException('price is required for LIMIT orders');
    }
  }

  /**
   * Resolve the price for an order based on its type
   */
  private async resolveOrderPrice(
    dto: CreateOrderDto,
    manager: EntityManager,
  ): Promise<number> {
    return dto.type === OrderType.LIMIT ? dto.price! : await this.getLatestPrice(dto.instrumentid!, manager);
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
        throw new BadRequestException('Amount is not enough to buy at least 1 share');
      }
      return calculatedSize;
    }

    throw new BadRequestException('Either size or amount must be provided');
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
      throw new BadRequestException(`No market data available for instrument ${instrumentid}`);
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
      throw new BadRequestException('Cash instrument (MONEDA) not found in database');
    }

    return cashInstrument;
  }
}
