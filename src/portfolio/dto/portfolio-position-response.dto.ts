import { ApiProperty } from '@nestjs/swagger';

export class PortfolioPositionDto {
  @ApiProperty({ example: 'GGAL', description: 'Instrument ticker' })
  ticker: string;

  @ApiProperty({ example: 'Grupo Financiero Galicia', description: 'Instrument name' })
  name: string;

  @ApiProperty({ example: 10, description: 'Number of shares held' })
  quantity: number;

  @ApiProperty({ example: 150.0, description: 'Last price (close) in ARS' })
  lastPrice: number;

  @ApiProperty({ example: 1500.0, description: 'Total position value in ARS' })
  totalValue: number;

  @ApiProperty({
    example: 12.5,
    description: 'Total return percentage (%)',
  })
  returnPercentage: number;
}