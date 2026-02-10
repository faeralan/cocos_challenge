import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 50, description: 'Total records matching the query' })
  total: number;

  @ApiProperty({ example: 20, description: 'Limit applied' })
  limit: number;

  @ApiProperty({ example: 0, description: 'Offset applied' })
  offset: number;

  @ApiProperty({ example: 20, description: 'Records in current response' })
  count: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;

  constructor(data: T[], total: number, limit: number, offset: number) {
    this.data = data;
    this.meta = {
      total,
      limit,
      offset,
      count: data.length,
    };
  }
}
