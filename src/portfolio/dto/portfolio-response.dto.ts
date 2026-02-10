import { ApiProperty } from '@nestjs/swagger';

export class PortfolioPositionDto {
  @ApiProperty({ example: 'AAPL', description: 'Instrument ticker' })
  ticker: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Instrument name' })
  name: string;

  @ApiProperty({ example: 10, description: 'Number of shares held' })
  quantity: number;

  @ApiProperty({ example: 1500.0, description: 'Total position value in $' })
  totalValue: number;

  @ApiProperty({
    example: 12.5,
    description: 'Total return percentage (%)',
  })
  returnPercentage: number;
}

export class PortfolioResponseDto {
  @ApiProperty({
    example: 15000.0,
    description: 'Total account value in $',
  })
  totalAccountValue: number;

  @ApiProperty({
    example: 5000.0,
    description: 'Available cash (ARS) for trading',
  })
  availableCash: number;

  @ApiProperty({
    type: [PortfolioPositionDto],
    description: 'List of asset positions',
  })
  positions: PortfolioPositionDto[];
}
