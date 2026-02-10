import { ApiProperty } from '@nestjs/swagger';

export class InstrumentResponseDto {
  @ApiProperty({ example: 34 })
  id: number;

  @ApiProperty({ example: 'GGAL' })
  ticker: string;

  @ApiProperty({ example: 'Grupo Financiero Galicia' })
  name: string;

  @ApiProperty({ example: 'ACCIONES' })
  type: string;
}
