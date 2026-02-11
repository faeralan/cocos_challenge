# Cocos Challenge Backend

Backend API for Cocos Challenge - A NestJS application with TypeORM, PostgreSQL, and Docker support, designed to be cloud-native and ECS/Fargate ready.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL database (external or local)

## Installation

1. Clone and install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_DATABASE=your-database
DB_SSL=true  # Set to 'true' for cloud databases
```

## 🏃 Running the Application

### Development (local)

```bash
npm run start:dev
```

### Production (Docker)

```bash
docker compose up
```

Or build and run manually:

```bash
docker build -t cocos-api .
docker run -p 3000:3000 --env-file .env cocos-api
```

## API Documentation

Once running, visit **Swagger UI** at:

```
http://localhost:3000/docs
```

## API Endpoints

### Portfolio
- `GET /portfolio/:userid` - Get user portfolio (total value, positions, returns)

### Instruments
- `GET /instruments?query=<search>` - Search instruments by ticker or name

### Orders
- `POST /orders` - Submit a new order (MARKET/LIMIT orders, CASH_IN/CASH_OUT transfers)
- `PATCH /orders/:id/cancel` - Cancel an existing order (only NEW orders can be cancelled)

### Order Examples

#### MARKET BUY (with size)
```json
POST /orders
{
  "userid": 1,
  "instrumentid": 1,
  "side": "BUY",
  "type": "MARKET",
  "size": 10
}
```

#### MARKET BUY (with amount - auto-calculates shares)
```json
POST /orders
{
  "userid": 1,
  "instrumentid": 1,
  "side": "BUY",
  "type": "MARKET",
  "amount": 5000.00
}
```

#### LIMIT SELL
```json
POST /orders
{
  "userid": 1,
  "instrumentid": 1,
  "side": "SELL",
  "type": "LIMIT",
  "size": 5,
  "price": 160.50
}
```

#### CASH_IN (deposit)
```json
POST /orders
{
  "userid": 1,
  "side": "CASH_IN",
  "amount": 100000
}
```

#### CASH_OUT (withdrawal)
```json
POST /orders
{
  "userid": 1,
  "side": "CASH_OUT",
  "amount": 50000
}
```

#### Cancel Order
```bash
PATCH /orders/123/cancel
```

**Order States:**
- `MARKET` orders → Executed immediately → Status: `FILLED` (or `REJECTED` if insufficient funds/holdings)
- `LIMIT` orders → Queued → Status: `NEW` (or `REJECTED` if insufficient funds/holdings)
- `CASH_IN` transfers → Status: `FILLED`
- `CASH_OUT` transfers → Status: `FILLED` (or `REJECTED` if insufficient funds)

## Database Schema

The application connects to an existing PostgreSQL database with the following tables:

- **users**: id, email, accountNumber
- **instruments**: id, ticker, name, type
- **orders**: id, instrumentId, userid, side, size, price, type, status, datetime
- **marketdata**: id, instrumentId, high, low, open, close, previousclose, datetime

### Dynamic Calculations

No separate positions table - all balances calculated in real-time:

- **Available cash**: SUM of FILLED orders (`CASH_IN` + `SELL` - `CASH_OUT` - `BUY`)
- **Holdings**: SUM of FILLED orders per instrument (`BUY` - `SELL`)


## 🧪 Testing

Run the test suite:

```bash
# All tests
npm test

# Orders service tests (25 tests)
npm test -- orders.service.spec.ts

# Watch mode
npm test -- --watch
```

Test coverage includes:
- ✅ MARKET and LIMIT order creation with funds/holdings validation
- ✅ Size calculation from amount
- ✅ Order rejection scenarios (insufficient funds/holdings)
- ✅ CASH_IN/CASH_OUT transfers with validation
- ✅ Field validation (reject unnecessary fields per operation type)
- ✅ Order cancellation (only NEW orders)
- ✅ Price validation (MARKET must not have price, LIMIT must have price)


## Docker

### Build

```bash
docker build -t cocos-api .
```

### Run

```bash
docker run -p 3000:3000 --env-file .env cocos-api
```

### Docker Compose

```bash
docker compose up -d
docker compose logs -f
docker compose down
```