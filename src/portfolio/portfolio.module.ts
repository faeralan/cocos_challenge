import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { Order } from '../entities/order.entity';
import { MarketData } from '../entities/market-data.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, MarketData, User])],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
