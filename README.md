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

## Running the Application

### Option 1: Local Development

Uses your local Node.js installation and connects to an external database:

```bash
npm run start:dev
```



**Requirements:**
- Node.js 20+ installed locally
- Database connection configured in `.env`

### Option 2: Docker Compose

Runs the app in a Docker container matching production deployment:

```bash
# First time or after code changes
docker compose up --build

# Or force complete rebuild if you see stale code
docker compose build --no-cache
docker compose up

# Run in background
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```


### Option 3: Manual Docker Build

For testing the Docker image directly:

```bash
# Build the image
docker build -t cocos-api .

# Run with environment variables
docker run -p 3000:3000 --env-file .env cocos-api

# Or pass variables directly
docker run -p 3000:3000 \
  -e DB_HOST=your-host \
  -e DB_PORT=5432 \
  -e DB_USERNAME=your-user \
  -e DB_PASSWORD=your-pass \
  -e DB_DATABASE=your-db \
  -e DB_SSL=true \
  cocos-api
```

### Verify Application is Running

Once started, visit:

- **API Health Check**: http://localhost:3000/health
- **Swagger Documentation**: http://localhost:3000/docs


## API Endpoints

### Portfolio
- `GET /portfolio/:userid` - Get user portfolio

### Instruments
- `GET /instruments?query=<search>` - Search instruments by ticker or name

### Orders
- `POST /orders` - Submit a new order
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

#### MARKET BUY (with amount)
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

#### CASH_IN
```json
POST /orders
{
  "userid": 1,
  "side": "CASH_IN",
  "amount": 100000
}
```

#### CASH_OUT
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


## Testing

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
- MARKET and LIMIT order creation with funds/holdings validation
- Size calculation from amount
- Order rejection scenarios (insufficient funds/holdings)
- CASH_IN/CASH_OUT transfers with validation
- Field validation (reject unnecessary fields per operation type)
- Order cancellation (only NEW orders)
- Price validation (MARKET must not have price, LIMIT must have price)

## Architecture & Design Decisions

> For detailed Architecture Decision Records (ADRs) covering deployment strategy, scaling, transaction management, and more, see [docs/ADR.md](./docs/ADR.md).



### 1. Error Handling & Logging

- Global exception filter (`AllExceptionsFilter`) catches all errors
- Returns structured JSON responses with HTTP status codes
- Logs full stack traces for debugging (visible in Docker logs and CloudWatch)
- Consistent error format across all endpoints

### Environment Variables for Production

**Required:**
- `DB_HOST` - Database hostname
- `DB_PORT` - Database port (default: 5432)
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password
- `DB_DATABASE` - Database name
- `DB_SSL` - Enable SSL for database connection (`true` for cloud databases)

**Optional:**
- `PORT` - Application port (default: 3000)
- `NODE_ENV` - Environment mode (default: development)
- `LOG_LEVEL` - Logging level (default: log)
- `SWAGGER_ENABLED` - Enable Swagger UI (default: true)


