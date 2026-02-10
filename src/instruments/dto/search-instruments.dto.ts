import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SearchInstrumentsDto {
  @ApiPropertyOptional({
    example: 'PATA',
    description: 'Search by ticker and/or name (case insensitive)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  query?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50, description: 'Max records to return' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0, description: 'Records to skip' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
