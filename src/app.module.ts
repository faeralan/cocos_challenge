import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, databaseConfig, swaggerConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './common/health/health.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { InstrumentsModule } from './instruments/instruments.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    // Global configuration from environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, swaggerConfig],
    }),

    // Database connection
    DatabaseModule,

    // Common modules
    HealthModule,

    // Feature modules
    PortfolioModule,
    InstrumentsModule,
    OrdersModule,
  ],
})
export class AppModule {}
