import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Calculate available cash for a user by summing all FILLED orders
   * availableCash =
      (CASH_IN)
    - (CASH_OUT)
    - (BUY size × price)
    + (SELL size × price)
   * 
   * @param userid - User ID
   * @param manager - Optional EntityManager for transactional context
   */
  async getAvailableCash(
    userid: number,
    manager?: EntityManager,
  ): Promise<number> {
    const querySource = manager ? manager.createQueryBuilder(Order, 'o') : this.orderRepository.createQueryBuilder('o');

    const result = await querySource
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
   * 
   * @param userid - User ID
   * @param instrumentid - Instrument ID
   * @param manager - Optional EntityManager for transactional context
   */
  async getInstrumentHolding(
    userid: number,
    instrumentid: number,
    manager?: EntityManager,
  ): Promise<number> {
    const querySource = manager ? manager.createQueryBuilder(Order, 'o') : this.orderRepository.createQueryBuilder('o');

    const result = await querySource
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
}
