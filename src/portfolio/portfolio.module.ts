import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { Order } from '../entities/order.entity';
import { MarketData } from '../entities/market-data.entity';
import { User } from '../entities/user.entity';
import { Instrument } from '../entities/instrument.entity';
import { AccountModule } from '../account/account.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MarketData, User, Instrument]),
    AccountModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
