import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderSide, OrderStatus, OrderType } from '../entities/order.entity';
import { Instrument } from '../entities/instrument.entity';
import { MarketData } from '../entities/market-data.entity';
import { User } from '../entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { AccountService } from '../account/account.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<Partial<Repository<Order>>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;
  let accountService: jest.Mocked<Partial<AccountService>>;

  const mockUser: User = {
    id: 1,
    email: 'test@test.com',
    accountnumber: '10001',
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

  const mockCashInstrument: Instrument = {
    id: 2,
    ticker: 'ARS',
    name: 'Peso Argentino',
    type: 'MONEDA',
    orders: [],
    marketData: [],
  };

  const mockMarketData: MarketData = {
    id: 1,
    instrumentid: 1,
    high: 155.0,
    low: 145.0,
    open: 150.0,
    close: 152.5,
    previousclose: 149.0,
    date: new Date(),
    instrument: mockInstrument,
  };

  const createMockEntityManager = () => {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    const mockManager = {
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    return { manager: mockManager, queryBuilder: mockQueryBuilder };
  };

  beforeEach(async () => {
    orderRepository = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    accountService = {
      getAvailableCash: jest.fn(),
      getInstrumentHolding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Instrument), useValue: {} },
        { provide: getRepositoryToken(MarketData), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: DataSource, useValue: dataSource },
        { provide: AccountService, useValue: accountService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder - BUY/SELL', () => {
    it('should create a MARKET BUY order with FILLED status when funds are sufficient', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      const savedOrder = {
        id: 1,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        price: 152.5,
        type: OrderType.MARKET,
        status: OrderStatus.FILLED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(mockMarketData);
      accountService.getAvailableCash.mockResolvedValue(10000);
      mockEM.manager.create.mockReturnValue(savedOrder);
      mockEM.manager.save.mockResolvedValue(savedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.FILLED);
      expect(result.price).toBe(152.5);
    });

    it('should create a LIMIT BUY order with NEW status', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 5,
        type: OrderType.LIMIT,
        price: 140.0,
      };

      const savedOrder = {
        id: 2,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 5,
        price: 140.0,
        type: OrderType.LIMIT,
        status: OrderStatus.NEW,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      accountService.getAvailableCash.mockResolvedValue(10000);
      mockEM.manager.create.mockReturnValue(savedOrder);
      mockEM.manager.save.mockResolvedValue(savedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.NEW);
      expect(result.price).toBe(140.0);
    });

    it('should create MARKET SELL order with FILLED status when holdings are sufficient', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.SELL,
        size: 5,
        type: OrderType.MARKET,
      };

      const savedOrder = {
        id: 3,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.SELL,
        size: 5,
        price: 152.5,
        type: OrderType.MARKET,
        status: OrderStatus.FILLED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(mockMarketData);
      accountService.getInstrumentHolding.mockResolvedValue(10);
      mockEM.manager.create.mockReturnValue(savedOrder);
      mockEM.manager.save.mockResolvedValue(savedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.FILLED);
    });

    it('should calculate size from amount for BUY order', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        amount: 1500,
        type: OrderType.MARKET,
      };

      const savedOrder = {
        id: 4,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 9, // Math.floor(1500 / 152.5) = 9
        price: 152.5,
        type: OrderType.MARKET,
        status: OrderStatus.FILLED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(mockMarketData);
      accountService.getAvailableCash.mockResolvedValue(10000);
      mockEM.manager.create.mockReturnValue(savedOrder);
      mockEM.manager.save.mockResolvedValue(savedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.size).toBe(9);
    });

    it('should throw BadRequestException if amount is insufficient for 1 share', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        amount: 10,
        type: OrderType.MARKET,
      };

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(mockMarketData);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should save BUY order as REJECTED when insufficient funds', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 100,
        type: OrderType.MARKET,
      };

      const rejectedOrder = {
        id: 5,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 100,
        price: 152.5,
        type: OrderType.MARKET,
        status: OrderStatus.REJECTED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(mockMarketData);
      accountService.getAvailableCash.mockResolvedValue(100);
      mockEM.manager.create.mockReturnValue(rejectedOrder);
      mockEM.manager.save.mockResolvedValue(rejectedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.REJECTED);
    });

    it('should save SELL order as REJECTED when insufficient holdings', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.SELL,
        size: 100,
        type: OrderType.MARKET,
      };

      const rejectedOrder = {
        id: 6,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.SELL,
        size: 100,
        price: 152.5,
        type: OrderType.MARKET,
        status: OrderStatus.REJECTED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(mockMarketData);
      accountService.getInstrumentHolding.mockResolvedValue(5);
      mockEM.manager.create.mockReturnValue(rejectedOrder);
      mockEM.manager.save.mockResolvedValue(rejectedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.REJECTED);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const dto: CreateOrderDto = {
        userid: 999,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValue(null);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if instrument does not exist', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 999,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(null);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if MARKET order has no market data', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
      };

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);
      mockEM.manager.findOne.mockResolvedValue(null);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if LIMIT order has no price', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.SELL,
        size: 5,
        type: OrderType.LIMIT,
        price: undefined,
      };

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockInstrument);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if MARKET order has price provided', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        type: OrderType.MARKET,
        price: 150.5, // Should not be provided for MARKET
      };

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if neither size nor amount is provided', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      };

      const mockEM = createMockEntityManager();

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        'Exactly one of size or amount must be provided',
      );
    });

    it('should throw BadRequestException if both size and amount are provided', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        amount: 1500,
        type: OrderType.MARKET,
      };

      const mockEM = createMockEntityManager();

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        'Exactly one of size or amount must be provided',
      );
    });
  });

  describe('createOrder - CASH_IN/CASH_OUT', () => {
    it('should create CASH_IN order with FILLED status', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        side: OrderSide.CASH_IN,
        size: 5000,
      };

      const savedOrder = {
        id: 7,
        userid: 1,
        instrumentid: 2,
        side: OrderSide.CASH_IN,
        size: 5000,
        price: 1,
        type: null,
        status: OrderStatus.FILLED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockCashInstrument);
      mockEM.manager.create.mockReturnValue(savedOrder);
      mockEM.manager.save.mockResolvedValue(savedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.FILLED);
      expect(result.instrumentid).toBe(2);
      expect(result.price).toBe(1);
    });

    it('should create CASH_OUT order with FILLED status when funds are sufficient', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        side: OrderSide.CASH_OUT,
        amount: 2000,
      };

      const savedOrder = {
        id: 8,
        userid: 1,
        instrumentid: 2,
        side: OrderSide.CASH_OUT,
        size: 2000,
        price: 1,
        type: null,
        status: OrderStatus.FILLED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockCashInstrument);
      accountService.getAvailableCash.mockResolvedValue(5000);
      mockEM.manager.create.mockReturnValue(savedOrder);
      mockEM.manager.save.mockResolvedValue(savedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.FILLED);
    });

    it('should save CASH_OUT as REJECTED when insufficient funds', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        side: OrderSide.CASH_OUT,
        size: 10000,
      };

      const rejectedOrder = {
        id: 9,
        userid: 1,
        instrumentid: 2,
        side: OrderSide.CASH_OUT,
        size: 10000,
        price: 1,
        type: null,
        status: OrderStatus.REJECTED,
        datetime: new Date(),
      } as Order;

      const mockEM = createMockEntityManager();
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockUser);
      mockEM.manager.findOneBy.mockResolvedValueOnce(mockCashInstrument);
      accountService.getAvailableCash.mockResolvedValue(100);
      mockEM.manager.create.mockReturnValue(rejectedOrder);
      mockEM.manager.save.mockResolvedValue(rejectedOrder);

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      const result = await service.createOrder(dto);

      expect(result.status).toBe(OrderStatus.REJECTED);
    });

    it('should throw BadRequestException if CASH_IN has instrumentid provided', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        side: OrderSide.CASH_IN,
        size: 5000,
        instrumentid: 1, // Should not be provided
      };

      const mockEM = createMockEntityManager();

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        'instrumentid must not be provided for cash transfers',
      );
    });

    it('should throw BadRequestException if CASH_IN has type provided', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        side: OrderSide.CASH_IN,
        size: 5000,
        type: OrderType.MARKET, // Should not be provided
      };

      const mockEM = createMockEntityManager();

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        'type must not be provided for cash transfers',
      );
    });

    it('should throw BadRequestException if CASH_OUT has price provided', async () => {
      const dto: CreateOrderDto = {
        userid: 1,
        side: OrderSide.CASH_OUT,
        amount: 1000,
        price: 150.5, // Should not be provided
      };

      const mockEM = createMockEntityManager();

      dataSource.transaction.mockImplementation(async (cb) => cb(mockEM.manager));

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(dto)).rejects.toThrow(
        'price must not be provided for cash transfers',
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a NEW order', async () => {
      const order = {
        id: 1,
        userid: 1,
        instrumentid: 1,
        side: OrderSide.BUY,
        size: 10,
        price: 150,
        type: OrderType.LIMIT,
        status: OrderStatus.NEW,
        datetime: new Date(),
      } as Order;

      const cancelledOrder = { ...order, status: OrderStatus.CANCELLED };

      orderRepository.findOneBy.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(cancelledOrder);

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(orderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
    });

    it('should throw BadRequestException when trying to cancel FILLED order', async () => {
      const order = {
        id: 1,
        status: OrderStatus.FILLED,
      } as Order;

      orderRepository.findOneBy.mockResolvedValue(order);

      await expect(service.cancelOrder(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when trying to cancel REJECTED order', async () => {
      const order = {
        id: 1,
        status: OrderStatus.REJECTED,
      } as Order;

      orderRepository.findOneBy.mockResolvedValue(order);

      await expect(service.cancelOrder(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      orderRepository.findOneBy.mockResolvedValue(null);

      await expect(service.cancelOrder(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
