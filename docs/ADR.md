# Architecture Decision Records (ADR)

This project documents important architectural decisions following the ADR format.

---

## ADR-001: Monolithic Architecture

**Date:** 2026-02-11  
**Status:** Accepted

### Context

Time-constrained challenge requiring a production-ready financial application. Three options were evaluated: monolith, microservices, and serverless functions (Lambda).

### Decision

Implement a containerized NestJS monolith with well-separated modules (`OrdersModule`, `PortfolioModule`, `AccountModule`).

### Alternatives Considered

- **Microservices:** Rejected due to unnecessary complexity for project scope. Would require implementing distributed Sagas, event bus, service discovery, and distributed transaction management.
- **Lambda Functions:** Rejected due to incompatibility with complex ACID transactions and cold starts affecting user experience.

### Consequences

- Lower operational complexity
- Native PostgreSQL ACID transactions
- Simple Docker deployment
- Straightforward vertical scaling
- Facilitates future migration to microservices if needed (modules already separated)
- Horizontal scaling requires database connection management

---

## ADR-002: ECS/Fargate Deployment

**Date:** 2026-02-11  
**Status:** Accepted

### Context

Need for cloud-native deployment on AWS. Evaluated ECS/Fargate, Lambda, and Kubernetes.

### Decision

Deploy on AWS ECS with Fargate, using Application Load Balancer for traffic distribution and auto-scaling based on CPU/memory metrics.

### Alternatives Considered

- **AWS Lambda:** Rejected due to:
  - Cold starts of 3-5 seconds
  - Need for RDS Proxy to manage connections
  - Complexity of adapting NestJS to serverless model
  - 15-minute execution limit
- **Kubernetes (EKS):** Rejected due to unnecessary operational overhead for project scope

### Consequences

- Current code works without modifications
- Persistent database connections
- Simple horizontal auto-scaling (2-10 tasks)
- Native CloudWatch integration for logs
- Predictable costs
- Requires RDS Proxy configuration if exceeding 5 concurrent tasks

---

## ADR-003: Dynamic Balance Calculation (Event Sourcing)

**Date:** 2026-02-11  
**Status:** Accepted

### Context

Need to maintain cash balances and instrument positions. Evaluated between maintaining separate balance tables vs. calculating dynamically from order history.

### Decision

Calculate balances in real-time using SQL aggregations on orders with `status = 'FILLED'`. Do not maintain separate balance or position tables.

### Alternatives Considered

- **Separate Balance Tables:** Rejected due to:
  - Risk of inconsistencies between tables
  - Need for triggers or events for synchronization
  - Greater complexity in transactions
  - Difficulty with historical auditing

### Consequences

- Guaranteed consistency (single source of truth)
- Ability to calculate balances at any point in time
- Simplifies transactional logic
- Higher computational load on queries (mitigable with indexes and cache)

### Implementation

```sql
-- Available Cash
SUM(CASE
  WHEN side IN ('CASH_IN', 'SELL') THEN size * price
  WHEN side IN ('CASH_OUT', 'BUY') THEN -size * price
END)

-- Holdings per Instrument
SUM(CASE
  WHEN side = 'BUY' THEN size
  WHEN side = 'SELL' THEN -size
END)
```

### Optimization Path

- Indexes on `(userid, status, side)` for balance queries
- Redis cache with 60-second TTL for balances
- Cache invalidation when creating FILLED orders

---

## ADR-004: Native ACID Transactions

**Date:** 2026-02-11  
**Status:** Accepted

### Context

Financial operations require atomicity: funds/holdings validation and order creation must be atomic.

### Decision

Use native PostgreSQL transactions via TypeORM's `DataSource.transaction()`. All order creation operations execute within a transaction.

### Alternatives Considered

- **Distributed Sagas:** Unnecessary for monolithic architecture
- **Optimistic Locking:** Insufficient to guarantee complete atomicity
- **Explicit Locks:** Unnecessary complexity, PostgreSQL handles locks automatically

### Consequences

- Guaranteed data integrity
- Automatic rollback on error
- Implementation simplicity
- Atomic validations and persistence
- Support for transactional context in shared services (`AccountService`)

### Transaction Scope

```typescript
dataSource.transaction(async (manager) => {
  // 1. Validate user
  // 2. Validate instrument
  // 3. Calculate price (MARKET orders)
  // 4. Validate funds/holdings
  // 5. Create and save order
  // All or nothing - automatic rollback on error
});
```

---

## ADR-005: Database-First Approach

**Date:** 2026-02-11  
**Status:** Accepted

### Context

Database schema is provided externally and managed outside the application.

### Decision

Configure TypeORM with `synchronize: false` in all environments. Entities map to existing tables for queries only.

---

## Possible Improvements

> This section outlines potential optimizations and enhancements that could be implemented given more development time. These improvements are prioritized by impact vs. effort.

### High Priority (High Impact, Low-Medium Effort)

#### 1. Database Indexes

**Current State:** Queries rely on PostgreSQL's default indexing.

**Improvement:** Add composite indexes for frequently-queried patterns:

```sql
-- Index for balance calculations (getAvailableCash)
CREATE INDEX idx_orders_userid_status_side
ON orders(userid, status, side)
WHERE status = 'FILLED';

-- Index for market data lookups
CREATE INDEX idx_marketdata_instrument_date
ON marketdata(instrumentid, date DESC);

-- Index for portfolio positions
CREATE INDEX idx_orders_portfolio
ON orders(userid, instrumentid, status, side)
WHERE status = 'FILLED' AND side IN ('BUY', 'SELL');

```

**Impact:** 50-80% reduction in query execution time for balance and portfolio calculations.  

#### 2. Redis Caching Layer

**Current State:** All balance and portfolio queries hit the database directly.

**Improvement:** Implement Redis caching for frequently-accessed data:

- Balance calculations with 60-second TTL
- Portfolio positions with 60-second TTL
- Cache invalidation on FILLED order creation
