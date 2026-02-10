import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { InstrumentsService } from './instruments.service';
import { SearchInstrumentsDto } from './dto/search-instruments.dto';
import { InstrumentResponseDto } from './dto/instrument-response.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../common/dto/paginated-response.dto';

@ApiTags('Instruments')
@Controller('instruments')
@ApiExtraModels(PaginatedResponseDto, PaginationMetaDto, InstrumentResponseDto)
export class InstrumentsController {
  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Search instruments by ticker and/or name' })
  @ApiResponse({ 
    status: 200, 
    description: 'Paginated list of instruments',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(InstrumentResponseDto) }
        },
        meta: {
          $ref: getSchemaPath(PaginationMetaDto)
        }
      }
    }
  })
  async search(@Query() dto: SearchInstrumentsDto) {
    const { data, total } = await this.instrumentsService.search({
      query: dto.query,
      limit: dto.limit,
      offset: dto.offset,
    });

    return new PaginatedResponseDto(
      data,
      total,
      dto.limit ?? 20,
      dto.offset ?? 0,
    );
  }
}
