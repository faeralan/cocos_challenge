import { ApiProperty } from '@nestjs/swagger';
import { PortfolioPositionDto } from './portfolio-position-response.dto';

export class PortfolioResponseDto {
  @ApiProperty({
    example: 1,
    description: 'User ID',
  })
  userid: number;

  @ApiProperty({
    example: 15000.0,
    description: 'Total account value in ARS',
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
