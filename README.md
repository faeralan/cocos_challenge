# Cocos Challenge Backend

Backend API for Cocos Challenge - A NestJS application with TypeORM, PostgreSQL, and Docker support, designed to be cloud-native and ECS/Fargate ready.

## 📋 Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL database (external or local)

## 🛠️ Installation

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

## 📡 API Endpoints

### Portfolio
- `GET /portfolio/:userId` - Get user portfolio (total value, positions, returns)

### Instruments
- `GET /instruments?query=<search>` - Search instruments by ticker or name

### Orders
- `POST /orders` - Submit a new order

## Database Schema

The application connects to an existing PostgreSQL database with the following tables:

- **users**: id, email, accountNumber
- **instruments**: id, ticker, name, type
- **orders**: id, instrumentId, userId, side, size, price, type, status, datetime
- **marketdata**: id, instrumentId, high, low, open, close, previousClose, datetime

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