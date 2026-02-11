import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';
import { PortfolioPositionDto } from './dto/portfolio-position-response.dto';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { User } from '../entities/user.entity';
import { MarketData } from '../entities/market-data.entity';
import { AccountService } from '../account/account.service';
import { RawPositionWithCost } from './interfaces/position.interface';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    private readonly accountService: AccountService,
  ) {}

  async getPortfolio(userid: number): Promise<PortfolioResponseDto> {
    // 1. Get user info
    const user = await this.userRepository.findOneBy({ id: userid });
    if (!user) {
      throw new NotFoundException(`User with id ${userid} not found`);
    }

    const [availableCash, rawPositions] = await Promise.all([
      this.accountService.getAvailableCash(userid),
      this.getUserPositionsWithCost(userid),
    ]);

    // 2. Build positions with market data
    const positions = await this.buildPositions(rawPositions);

    // 3. Calculate total account value
    const totalAccountValue = availableCash + positions.reduce((sum, pos) => sum + pos.totalValue, 0);

    return {
      userid,
      totalAccountValue: this.round(totalAccountValue),
      availableCash: this.round(availableCash),
      positions,
    };
  }

  /**
   * Get all positions for a user with net invested amount in a single query
   * Calculates both quantity and net invested amount (BUY - SELL) per instrument
   */
  private async getUserPositionsWithCost(userid: number): Promise<RawPositionWithCost[]> {
    return this.orderRepository
      .createQueryBuilder('o')
      .select('o.instrumentid', 'instrumentid')
      .addSelect('i.ticker', 'ticker')
      .addSelect('i.name', 'name')
      .addSelect(
        `SUM(
          CASE
            WHEN o.side = 'BUY' THEN o.size
            WHEN o.side = 'SELL' THEN -o.size
            ELSE 0
          END
        )`,
        'quantity',
      )
      .addSelect(
        `SUM(
          CASE
            WHEN o.side = 'BUY' THEN COALESCE(o.price, 1) * o.size
            WHEN o.side = 'SELL' THEN -(COALESCE(o.price, 1) * o.size)
            ELSE 0
          END
        )`,
        'netInvestedAmount',
      )
      .innerJoin('instruments', 'i', 'o.instrumentid = i.id')
      .where('o.userid = :userid', { userid })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .andWhere('o.side IN (:...sides)', { sides: [OrderSide.BUY, OrderSide.SELL] })
      .groupBy('o.instrumentid')
      .addGroupBy('i.ticker')
      .addGroupBy('i.name')
      .having(
        `SUM(
          CASE
            WHEN o.side = 'BUY' THEN o.size
            WHEN o.side = 'SELL' THEN -o.size
            ELSE 0
          END
        ) > 0`,
      )
      .getRawMany<RawPositionWithCost>();
  }

  /**
   * Build position DTOs with market data
   */
  private async buildPositions(rawPositions: RawPositionWithCost[]): Promise<PortfolioPositionDto[]> {
    if (rawPositions.length === 0) {
      return [];
    }

    const instrumentIds = rawPositions.map((p) => p.instrumentid);
    const marketDataMap = await this.getLatestMarketDataMap(instrumentIds);

    const positions: PortfolioPositionDto[] = [];

    for (const raw of rawPositions) {
      const marketData = marketDataMap.get(raw.instrumentid);
      
      if (!marketData) {
        continue;
      }

      const quantity = Number(raw.quantity);
      const lastPrice = Number(marketData.close);
      const netInvestedAmount = Number(raw.netInvestedAmount);
      
      // Average cost adjusted = net invested amount / current quantity
      const averageCost = quantity > 0 ? netInvestedAmount / quantity : 0;
      
      const totalValue = quantity * lastPrice;
      
      // Return percentage based on adjusted average cost
      const returnPercentage = averageCost > 0 
        ? ((lastPrice - averageCost) / averageCost) * 100 
        : 0;

      positions.push({
        ticker: raw.ticker,
        name: raw.name,
        quantity,
        lastPrice: this.round(lastPrice),
        totalValue: this.round(totalValue),
        returnPercentage: this.round(returnPercentage),
      });
    }

    return positions;
  }

  /**
   * Get latest market data for multiple instruments as a map
   */
  private async getLatestMarketDataMap(instrumentIds: number[]): Promise<Map<number, MarketData>> {
    // Get latest market data for each instrument using DISTINCT ON (PostgreSQL-specific)
    if (instrumentIds.length === 0) {
      return new Map();
    }

    const latestMarketData = await this.marketDataRepository
      .createQueryBuilder('md')
      .distinctOn(['md.instrumentid'])
      .where('md.instrumentid IN (:...ids)', { ids: instrumentIds })
      .orderBy('md.instrumentid')
      .addOrderBy('md.date', 'DESC')
      .getMany();

    // Convert to map for O(1) lookup
    const map = new Map<number, MarketData>();
    for (const md of latestMarketData) {
      map.set(md.instrumentid, md);
    }

    return map;
  }

  /**
   * Round a number to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
