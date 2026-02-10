import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';

@ApiTags('Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':userid')
  @ApiOperation({ summary: 'Get portfolio for a user' })
  @ApiParam({ name: 'userid', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, type: PortfolioResponseDto })
  async getPortfolio(
    @Param('userid', ParseIntPipe) userid: number,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.getPortfolio(userid);
  }
}
