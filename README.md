# 🛡️ BalanceVault — Secure Ledger Platform

> **Enterprise-grade, high-integrity multi-account balance management & atomic ledger platform with ACID transactions, Redis-backed rate limiting, RBAC governance, and immutable audit logs.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748?logo=prisma)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-RateLimiting-red?logo=redis)](https://redis.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Architecture & Ledger Mechanics](#-architecture--ledger-mechanics)
- [Core Features](#-core-features)
- [Tech Stack](#-tech-stack)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Environment Configuration](#-environment-configuration)
- [Quick Start Guide](#-quick-start-guide)
- [Default Seed Accounts](#-default-seed-accounts)
- [Database Migration & SQLSTATE 42501 Safety](#-database-migration--sqlstate-42501-safety)
- [License](#-license)

---

## 🌟 Overview

**BalanceVault** is engineered for institutions, fintech innovators, and hackathons requiring mathematically verifiable, zero-loss double-entry balance operations. It eliminates race conditions, double-spend vulnerabilities, and unauthorized access through:

1. **Strict PostgreSQL Transactions (`SERIALIZABLE` / `READ COMMITTED` with atomic row updates)**.
2. **Distributed Redis Rate-Limiting** to defend auth and transfer routes from brute-force attacks.
3. **Role-Based Access Control (RBAC)** distinguishing between `ADMIN`, `OPERATOR`, `AUDITOR`, and standard `USER` accounts.
4. **Non-Repudiation Audit Logging** capturing metadata, IP addresses, and user agents on every state transition.
5. **Modern Dark-Mode Frontend** powered by React 18, Vite, and Tailwind CSS.

---

## 🏛 Architecture & Ledger Mechanics

```mermaid
flowchart TD
    Client["React + Vite Client (Tailwind Dark UI)"]
    Gateway["Express Gateway + Helmet + CORS"]
    RL["Redis Rate-Limiter (In-Memory Fallback)"]
    Auth["JWT + RBAC Middleware (Role Checker)"]
    LedgerTx["Atomic Ledger Engine (ACID Transaction)"]
    DB[(PostgreSQL Database via Prisma)]
    Audit["Audit Logger (SQLSTATE 42501 Protected)"]

    Client -->|HTTP / Bearer JWT| Gateway
    Gateway --> RL
    RL --> Auth
    Auth --> LedgerTx
    LedgerTx -->|Debit Source + Credit Dest| DB
    LedgerTx -->|Append Record| Audit
    Audit --> DB
```

---

## 🚀 Core Features

- **Multi-Account Segregation:** Create and manage separate Checking, Savings, Investment, Escrow, and Treasury accounts per user.
- **Atomic Fund Transfers:** Balance verification, source account debit, destination account credit, and transaction creation run as an atomic, all-or-nothing unit.
- **Enterprise Rate Limiter:** Guarded by Redis with automatic graceful in-memory fallback.
- **RBAC Governance:**
  - `ADMIN`: Complete control over users, privileges, liquidity accounts, and audit views.
  - `AUDITOR`: Dedicated read-only access to chronological security logs.
  - `OPERATOR`: System operations and user directory support.
  - `USER`: Autonomous multi-account balance management and transfers.
- **Health & Readiness Endpoints:** Standardized `/api/health` and `/api/ready` probes for Kubernetes, Docker, and uptime monitors.
- **Permission-Safe Seeding:** Prevents PostgreSQL `SQLSTATE 42501` insufficient privilege errors when seeding cloud-managed databases (e.g., Neon, Supabase, RDS).

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js (v20+ recommended)
- **Language:** TypeScript
- **Framework:** Express.js
- **ORM:** Prisma 5.14
- **Database:** PostgreSQL (with connection pooling)
- **Cache & Rate-Limiter:** Redis (via `ioredis` and `rate-limit-redis`)
- **Security:** Helmet, CORS, bcryptjs, JSON Web Tokens (JWT), Zod schema validation

### Frontend
- **Framework:** React 18
- **Tooling:** Vite 5
- **Styling:** Tailwind CSS 3.4 (Fintech Dark Theme)
- **Icons:** Lucide React
- **State Management:** React Context API + LocalStorage Auth Persistence

---

## 📡 API Endpoints Reference

### Health & Monitoring
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Liveness probe (uptime, memory, status) |
| `GET` | `/api/ready` | Public | Readiness probe (verifies PostgreSQL & Redis connectivity) |

### Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Rate-limited | Register new user + provision initial checking account |
| `POST` | `/api/auth/login` | Rate-limited | Authenticate credentials and return JWT |
| `GET` | `/api/auth/me` | Authenticated | Fetch active user profile and accounts |

### Vault Accounts
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/accounts` | Authenticated | List all accounts belonging to authenticated user |
| `POST` | `/api/accounts` | Authenticated | Open new Checking, Savings, or Investment account |
| `GET` | `/api/accounts/:id` | Authenticated | Get account details with recent transactions |

### Transactions & Ledger
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/transactions/transfer` | Authenticated | Execute atomic fund transfer to any account number |
| `POST` | `/api/transactions/deposit` | Authenticated | Top up account balance |
| `GET` | `/api/transactions` | Authenticated | Retrieve transaction history with pagination |

### Administration & Audit (RBAC)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | `ADMIN`, `OPERATOR` | List all users with account counts and filters |
| `PATCH` | `/api/admin/users/:id` | `ADMIN` | Update user role (`ADMIN`, `USER`, etc.) or active status |
| `GET` | `/api/admin/audit-logs` | `ADMIN`, `AUDITOR` | View immutable system audit trail |

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Application environment | `development` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/balancevault?schema=public` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD`| Redis authentication password | *(optional)* |
| `JWT_SECRET` | Secret key for JWT signing | *(32+ char secret string)* |
| `JWT_EXPIRES_IN` | Token validity duration | `24h` |
| `BCRYPT_SALT_ROUNDS` | Salt rounds for password hashing | `12` |
| `DEFAULT_ADMIN_EMAIL` | Bootstrap admin email | `admin@balancevault.com` |
| `DEFAULT_ADMIN_PASSWORD` | Bootstrap admin password | `Admin@123` |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher)
- [PostgreSQL](https://www.postgresql.org/) database
- [Redis](https://redis.io/) *(Optional; system automatically falls back to in-memory store if Redis is absent)*

### 2. Install Dependencies
```bash
# Install root backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 3. Initialize Database
```bash
# Generate Prisma Client types
npm run db:generate

# Run migrations to provision tables
npm run db:migrate

# Seed database with initial Admin and Demo accounts
npm run db:seed
```

### 4. Run Development Servers
```bash
# Starts both Express backend (:5000) and Vite frontend (:5173) concurrently
npm run dev
```

Visit **http://localhost:5173** to view the application!

---

## 🔑 Default Seed Accounts

The bootstrap script (`npm run db:seed`) provisions the following testing accounts:

### 🛡️ Administrator Account
- **Email:** `admin@balancevault.com`
- **Password:** `Admin@123`
- **Role:** `ADMIN`
- **Pre-provisioned:** Master Vault Treasury (`BV-TREASURY-001`) with **$1,000,000.00**

### 👤 Demo Member Account
- **Email:** `user@balancevault.com`
- **Password:** `User@123`
- **Role:** `USER`
- **Pre-provisioned:**
  - Checking Account (`BV-CHK-100293`): **$15,420.50**
  - Savings Account (`BV-SAV-883012`): **$45,000.00**

---

## 🛡️ Database Migration & SQLSTATE 42501 Safety

When using non-superuser database connections (such as on AWS RDS, Supabase, Neon, or Neon Postgres branching), standard migration scripts may fail with:
```
ERROR: permission denied for schema / table (SQLSTATE 42501)
```

BalanceVault explicitly handles this by:
1. Using pure Prisma client schema models without relying on raw superuser extensions (`pgcrypto`, `uuid-ossp`).
2. Wrapping all audit and seed insertions in dedicated safety blocks that catch `42501` / `P2010` exception codes and gracefully alert without halting system operation.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
