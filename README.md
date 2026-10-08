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

## 🌍 The Problem it Solves
When environmental scientists collect samples (like groundwater, soil, or air quality tests), they generate a massive paper trail. A single sample requires:

1. **Field Notes:** Handwritten observations at the site.
2. **Chain of Custody (CoC):** Legal documents proving who handled the sample.
3. **Lab Reports:** The final chemical analysis results.

If an audit happens and a lab report is missing its matching Chain of Custody, the data becomes legally invalid. Keeping track of hundreds of samples across multiple physical papers and digital PDFs is a logistical nightmare.

## 🛠️ How Hydra Works (A Quick Guide)
Hydra acts as a central "Evidence Desk" that ingests, reads, and connects all these scattered documents automatically.

### 1. Smart Data Ingestion (The AI Dashboard)
If a technician returns from the field with a dirty, crumpled piece of paper containing their field notes, they simply take a photo of it and upload it to Hydra.
* **What Hydra does:** The AI service uses OCR to read the text in the image. It then uses the **Gemini AI** to understand the text, automatically extracting the `Sample ID` and `Site Name`, and saving it as a digitized, searchable record.

### 2. Evidence Coverage (The Sample Register)
Users can upload their PDF Lab Reports and Chain of Custody files, typing in the Sample ID.
* **What Hydra does:** It automatically groups records by their Sample ID. The dashboard features a "Coverage" table that instantly flags any sample that is missing its "Core Pair" (e.g., it has a Lab Report, but no Chain of Custody). This prevents incomplete packets from leaving the lab.

### 3. Multi-Keyword Search
If a manager needs to find every document related to a specific chemical (like "Benzene") at a specific site (like "North Well").
* **What Hydra does:** They type "Benzene North Well" into the search bar. The backend search engine quickly finds and returns any document containing both keywords, highlighting a snippet of where it was found.

### 4. "Ask the Records" (RAG Assistant)
Instead of reading through 50 pages of complex PDF lab reports, a user can simply ask the AI: *"What were the VOC levels for sample GW-24-018?"*
* **What Hydra does:** It converts the question into a mathematical vector, searches the database for the most relevant paragraphs across all documents, and then asks Gemini to read those paragraphs and formulate a direct answer. It even provides citations (e.g., `[E1]`) pointing exactly to the source document it got the answer from!

## Core Capabilities

- **Premium UI/UX:** A stunning, fully responsive dashboard featuring glassmorphism, depth shadows, micro-animations, and a specialized dark/light theme (Acid/Forest).
- **Real-Time Sync:** Uploads trigger instant, page-less refreshes across connected clients using WebSockets and Redis Pub/Sub.
- **Smart Autofill Extraction:** Using Gemini, uploaded field notes photos are scanned via OCR and analyzed by a custom LLM prompt to automatically extract and autofill the `Sample ID` and `Site Name`.
- **Multi-Keyword Search:** A robust SQLite-powered search engine that tokenizes queries and performs multi-word AND matching for pinpoint accuracy.
- Upload text, CSV, and searchable PDF records up to 20 MB and 100 PDF pages.
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