# 🌊 Project Hydra: Distributed Document Intelligence & Real-Time Notification Platform.

## Overview
Project Hydra is a production-grade, polyglot microservices platform for document management, real-time collaboration, and AI-powered semantic search. Built with a focus on scalability, fault tolerance, and clean architecture.

## Architecture Diagram
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT LAYER                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  React SPA   │    │ Chrome Extension │    │  (Future) Mobile App      │  │
│  │  (Vite)      │    │  (Manifest V3)   │    │  (Kotlin)                 │  │
│  └──────┬───────┘    └────────┬─────────┘    └─────────────┬─────────────┘  │
└─────────┼─────────────────────┼────────────────────────────┼────────────────┘
          │                     │                            │
          └─────────────────────┼────────────────────────────┘
                                │ HTTPS / WSS
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Node.js + Express)                     │
│  - JWT Authentication & Authorization (bcrypt, jsonwebtoken)                │
│  - Reverse Proxy (http-proxy-middleware)                                    │
│  - WebSocket Server (ws) for real-time push notifications                   │
│  - MySQL (Users) | Redis (Session Cache & Pub/Sub Broker)                   │
└──────────────┬──────────────────────┬──────────────────────┬────────────────┘
               │                      │                      │
               ▼                      ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  DOCUMENT SERVICE    │  │   SEARCH SERVICE     │  │     AI SERVICE       │
│  (FastAPI + Python)  │  │   (Flask + Python)   │  │  (FastAPI + Python)  │
│  - File Uploads      │  │  - Inverted Index    │  │  - Smart Extraction   │
│  - Async I/O (Motor) │  │  - SQLite Queries    │  │  - FAISS (Vectors)   │
│  - MongoDB           │  │  - SQLite            │  │  - Gemini API        │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

## Tech Stack & Polyglot Architecture

| Layer | Technologies | Primary Purpose |
| --- | --- | --- |
| Frontend | React, Vite, Axios, Context API, Chrome Extension (Manifest V3) | User interface, browser integration, and global state management |
| API Gateway | Node.js, Express, JWT, bcrypt, `http-proxy-middleware`, `ws` | Authentication, routing, reverse proxying, and real-time WebSockets |
| Document Service | Python, FastAPI, Motor, MongoDB | Asynchronous document uploads, processing, and storage |
| Search Service | Python, Flask, SQLite | Document indexing and full-text search operations |
| AI Service | Python, FastAPI, FAISS, Gemini API | Intelligent extraction, embeddings, and document assistance |
| Databases and Caches | MySQL, MongoDB, SQLite, Redis | Structured data, document storage, indexing, sessions, and pub/sub |
| DevOps | Docker, Docker Compose, Git, GitHub | Containerization, orchestration, and version control |

## Key Features

- **Stateless Authentication:** Centralized JWT verification at the API Gateway.
- **Real-Time Push Notifications:** WebSockets with Redis Pub/Sub brokers.
- **Asynchronous Document Pipelines:** Non-blocking file processing with FastAPI.
- **Semantic document search:** Embeddings and Gemini-powered assistance for finding useful context.
- **Multi-Container Orchestration:** Single-command local environment execution with Docker Compose.

## Sample Evidence Desk

Hydra is tailored to small environmental testing teams that need to keep field collection records connected to laboratory results. Each evidence record can be tagged with a sample ID, site, and record type; the register groups those records and flags samples without both a chain-of-custody record and a lab report. This is a record-presence check, not a regulatory compliance determination.

- Upload text, CSV, and searchable PDF records up to 20 MB and 100 PDF pages.
- Extract scanned field sheets from images up to 10 MB; extracted text is indexed under the same sample and site.
- Search and AI retrieval are scoped to the signed-in user's records. Assistant answers return source records and do not replace professional review.
- The assistant requires `GEMINI_API_KEY`. Keyword search and the sample register work without it.

The search service is internal to the Compose network; use the authenticated gateway rather than calling it directly.

## Getting Started

### Prerequisites

Make sure the following tools are installed locally:

- Docker Desktop, running
- Git

### Environment Setup

Create a `.env` file in the repository root. Do not commit this file to version control.

```env
MYSQL_ROOT_PASSWORD=your_mysql_password
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
RESEND_API_KEY=your_resend_api_key
MAIL_FROM=Hydra <noreply@your-domain.com>
ALLOW_DEV_VERIFICATION=false
CORS_ORIGIN=https://your-domain.com
```

### Running the Application

Clone the repository:

```bash
git clone https://github.com/Ehakl/Project-HYDRA..git
cd Project-HYDRA
```

Build and launch all microservices with Docker Compose:

```bash
docker compose up --build
```

### Service URLs

| Service | URL |
| --- | --- |
| Frontend Application | [http://localhost:80](http://localhost:80) |
| API Gateway | [http://localhost:5000](http://localhost:5000) |

### API key requirements

- Login, registration, document upload, document listing, and search work without a third-party API key.
- Smart file extraction works locally; document assistance requires `GEMINI_API_KEY`.
- Account confirmation requires `RESEND_API_KEY` and a verified `MAIL_FROM` address in production.
- With no `RESEND_API_KEY` and `ALLOW_DEV_VERIFICATION=true`, local registration returns a development code in the UI and sends no email. Keep this disabled in production.
- Set `CORS_ORIGIN` to the exact public frontend origin before launch.

### Focused checks

Run the search ownership and migration regression tests in the Compose service image:

```bash
docker compose run --rm --no-deps search-service python -m unittest discover -s /app -p 'test_*.py'
```

Build the production frontend bundle:

```bash
npm --prefix frontend run build
```