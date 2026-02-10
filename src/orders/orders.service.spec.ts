import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderSide, OrderStatus, OrderType } from '../entities/order.entity';
import { Instrument } from '../entities/instrument.entity';
import { MarketData } from '../entities/market-data.entity';
import { User } from '../entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<Partial<Repository<Order>>>;
  let instrumentRepository: jest.Mocked<Partial<Repository<Instrument>>>;
  let marketDataRepository: jest.Mocked<Partial<Repository<MarketData>>>;
  let userRepository: jest.Mocked<Partial<Repository<User>>>;

  const mockUser: User = {
    id: 1,
    email: 'test@test.com',
    accountNumber: '10001',
    orders: [],
  };

  const mockInstrument: Instrument = {
    id: 1,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'ACCIONES',
    orders: [],
    marketData: [],
  };

  const mockMarketData: MarketData = {
    id: 1,
    instrumentId: 1,
    high: 155.0,
    low: 145.0,
    open: 150.0,
    close: 152.5,
    previousClose: 149.0,
    datetime: new Date(),
    instrument: mockInstrument,
  };

  beforeEach(async () => {
    orderRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    instrumentRepository = {
      findOneBy: jest.fn(),
    };
    marketDataRepository = {
      findOne: jest.fn(),
    };
    userRepository = {
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Instrument), useValue: instrumentRepository },
        { provide: getRepositoryToken(MarketData), useValue: marketDataRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create a MARKET order with latest market price', async () => {
      const dto: CreateOrderDto = {
        userId: 1,
        instrumentId: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      const savedOrder = {
        id: 1,
        ...dto,
        price: 152.5,
        status: OrderStatus.NEW,
        datetime: new Date(),
      } as Order;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      instrumentRepository.findOneBy.mockResolvedValue(mockInstrument);
      marketDataRepository.findOne.mockResolvedValue(mockMarketData);
      orderRepository.create.mockReturnValue(savedOrder);
      orderRepository.save.mockResolvedValue(savedOrder);

      const result = await service.createOrder(dto);

      expect(result).toEqual(savedOrder);
      expect(result.price).toBe(152.5);
      expect(result.status).toBe(OrderStatus.NEW);
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('should create a LIMIT order with provided price', async () => {
      const dto: CreateOrderDto = {
        userId: 1,
        instrumentId: 1,
        side: OrderSide.BUY,
        size: 5,
        type: OrderType.LIMIT,
        price: 140.0,
      };

      const savedOrder = {
        id: 2,
        ...dto,
        status: OrderStatus.NEW,
        datetime: new Date(),
      } as Order;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      instrumentRepository.findOneBy.mockResolvedValue(mockInstrument);
      orderRepository.create.mockReturnValue(savedOrder);
      orderRepository.save.mockResolvedValue(savedOrder);

      const result = await service.createOrder(dto);

      expect(result).toEqual(savedOrder);
      expect(result.price).toBe(140.0);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const dto: CreateOrderDto = {
        userId: 999,
        instrumentId: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.createOrder(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if instrument does not exist', async () => {
      const dto: CreateOrderDto = {
        userId: 1,
        instrumentId: 999,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      userRepository.findOneBy.mockResolvedValue(mockUser);
      instrumentRepository.findOneBy.mockResolvedValue(null);

      await expect(service.createOrder(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if MARKET order has no market data', async () => {
      const dto: CreateOrderDto = {
        userId: 1,
        instrumentId: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      userRepository.findOneBy.mockResolvedValue(mockUser);
      instrumentRepository.findOneBy.mockResolvedValue(mockInstrument);
      marketDataRepository.findOne.mockResolvedValue(null);

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if LIMIT order has no price', async () => {
      const dto: CreateOrderDto = {
        userId: 1,
        instrumentId: 1,
        side: OrderSide.SELL,
        size: 5,
        type: OrderType.LIMIT,
        price: undefined,
      };

      userRepository.findOneBy.mockResolvedValue(mockUser);
      instrumentRepository.findOneBy.mockResolvedValue(mockInstrument);

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
