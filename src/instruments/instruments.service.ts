import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instrument } from '../entities/instrument.entity';

@Injectable()
export class InstrumentsService {
  constructor(
    @InjectRepository(Instrument)
    private readonly instrumentRepository: Repository<Instrument>,
  ) {}

  async search(params: { 
    query?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<{ data: Instrument[]; total: number }> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    if (!params.query) {
      const [data, total] = await this.instrumentRepository.findAndCount({
        take: limit,
        skip: offset,
      });
      return { data, total };
    }

    const queryBuilder = this.instrumentRepository
      .createQueryBuilder('instrument')
      .where('instrument.ticker ILIKE :query', { query: `%${params.query}%` })
      .orWhere('instrument.name ILIKE :query', { query: `%${params.query}%` })
      .take(limit)
      .skip(offset);

    const [data, total] = await queryBuilder.getManyAndCount();
    
    return { data, total };
  }
}
