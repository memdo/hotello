# Hotello - AI-Powered Hotel Booking Ecosystem

![Hotello Cover Image](./hotello.png)

**Frontend & Presentation**
*   **Website (UI)**: [https://hotello-cnxn.onrender.com](https://hotello-cnxn.onrender.com)
*   **Demo Video**: [https://drive.google.com/drive/folders/1KzYstbnYhXSYW4l81bVvPUl99Wxmip4V?usp=sharing](https://drive.google.com/drive/folders/1KzYstbnYhXSYW4l81bVvPUl99Wxmip4V?usp=sharing)

**Backend Microservices**
*   **API Gateway**: [https://hotello-gateway.onrender.com](https://hotello-gateway.onrender.com)
*   **Hotel Service**: [https://hotello-2u5v.onrender.com](https://hotello-2u5v.onrender.com)
*   **Comments Service**: [https://hotello-comments-service.onrender.com](https://hotello-comments-service.onrender.com)
*   **Agent Service**: [https://hotello-agent-service.onrender.com](https://hotello-agent-service.onrender.com)
*   **Notification Worker**: [https://hotello-6qed.onrender.com](https://hotello-6qed.onrender.com)

---

Hotello is a highly scalable, microservice-based hotel booking platform. It demonstrates enterprise-grade architectural patterns, including a custom API Gateway, distributed polyglot persistence (SQL + NoSQL), distributed caching, asynchronous message queuing, and an autonomous AI Agent that utilizes server-side function calling to interact with the platform on behalf of the user.

---

## 🌟 Key Features

*   **Autonomous AI Assistant**: An integrated Chatbot powered by Cerebras Inference using the `gpt-oss-120b` model. It leverages tool-calling (function calling) to search databases and book reservations contextually without user navigation.
*   **Decoupled Microservices**: 5 distinct, Dockerized Node.js services communicating over a unified API Gateway.
*   **Polyglot Persistence**: 
    *   **PostgreSQL (Supabase)** for strictly structured, ACID-compliant relational data (Reservations, Availability).
    *   **MongoDB Atlas** for unstructured, high-throughput document data (User Reviews and Comments).
    *   **Supabase Storage (CDN)** for hosting public binary image blobs (Hotel cards, destination previews) seamlessly linked to the relational schema.
*   **Distributed Caching**: Upstash Redis Cloud caching for heavy read-operations (Hotel details, JWT sessions) with strict invalidation upon booking.
*   **Asynchronous Message Queuing**: CloudAMQP (RabbitMQ) decouples booking transactions from notification/logging processing to ensure zero-blocking API responses.
*   **Secure API Gateway**: Centralized proxy handling JWT authentication, request routing, and Redis-backed Rate Limiting to prevent DDoS.
*   **Glassmorphism UI**: A premium, responsive React/Vite frontend using modern design tokens and animations.

---

## 🛠️ Technologies Used

### Frontend
*   **React 19 & Vite**: Ultra-fast build tooling and UI rendering.
*   **React Router v7**: Client-side routing and layout management.
*   **React Leaflet**: Interactive maps for hotel location rendering.
*   **Vanilla CSS (Glassmorphism)**: Custom CSS architecture utilizing CSS Variables for seamless light/dark mode and frosted-glass aesthetics.

### Backend Microservices
*   **Node.js (v22)**: Core runtime for all microservices.
*   **Express.js**: Lightweight HTTP server framework used across all APIs.
*   **http-proxy-middleware**: Request routing within the API Gateway.
*   **amqplib**: RabbitMQ integration for event-driven messaging.
*   **Cerebras Cloud SDK**: Ultra-fast LLM integration for the Agent Service.
*   **Resend Node SDK**: Modern transactional email delivery for reservation alerts.

### Databases & Caching
*   **Supabase (PostgreSQL)**: Relational data, Row Level Security (RLS), and JSON Web Token (JWT) Authentication.
*   **MongoDB Atlas**: Distributed NoSQL document storage for comments.
*   **Upstash Redis**: Serverless in-memory data structure store for caching API responses and rate limiting.

### DevOps & Deployment
*   **Docker & Docker Compose**: Containerization for local development and parity with production.
*   **Render**: Cloud platform hosting the decentralized microservices and static frontend.
*   **CloudAMQP**: Fully managed RabbitMQ cluster.
*   **Azure Logic Apps**: Serverless scheduling for automated capacity audits and queue processing.

---

## 🏗️ High-Level System Architecture

Hotello abandons the traditional monolith in favor of a strictly decoupled, containerized microservices architecture. Below is the system topology illustrating how the various services interact.

```mermaid
flowchart TD
    %% Entities
    User((User UI))
    
    %% API Gateway Layer
    subgraph GatewayLayer [Gateway & Security]
        Gateway["API Gateway (Express)"]
        RateLimiter[("Redis Rate Limiter")]
    end
    
    %% Microservices Layer
    subgraph ServicesLayer [Microservices]
        HotelService["Hotel Service"]
        AgentService["AI Agent Service"]
        CommentsService["Comments Service"]
        NotifWorker["Notification Worker"]
    end
    
    %% Data Persistence Layer
    subgraph PersistenceLayer [Polyglot Persistence & Queues]
        Supabase[("PostgreSQL<br/>(Supabase)")]
        MongoDB[("MongoDB Atlas<br/>(Reviews)")]
        RedisCache[("Redis Cache<br/>(Upstash)")]
        RabbitMQ[["RabbitMQ<br/>(CloudAMQP)"]]
    end
    
    %% Connections
    User -- "REST / API Calls" --> Gateway
    Gateway -- "Verify Token / Quotas" --> RateLimiter
    
    Gateway -- "/api/v1/hotels" --> HotelService
    Gateway -- "/api/v1/agent" --> AgentService
    Gateway -- "/api/v1/comments" --> CommentsService
    
    %% Service to DB connections
    HotelService -- "Read/Write & RPC Bookings" --> Supabase
    HotelService -- "Cache Results" --> RedisCache
    HotelService -- "Publish Events" --> RabbitMQ
    
    CommentsService -- "Read/Write Comments" --> MongoDB
    CommentsService -- "Sync Ratings" --> RedisCache
    
    AgentService -- "Fetch Tools" --> HotelService
    AgentService -- "LLM API" --> Cerebras((Cerebras AI))
    
    NotifWorker -- "Consume Events" --> RabbitMQ
```

---

## 🔄 Deep Dive: Core User Flows

### 1. The Booking Flow (Atomic Transactions & Event Queues)

To completely eliminate the risk of double-booking and availability drift, reservations are executed entirely within a strict PostgreSQL RPC function (`book_room`). The RPC explicitly checks and decrements daily room capacities in the `room_availability` table using row-level locks (`FOR UPDATE`). 

To ensure the API responds instantly to the user, background tasks like sending confirmation emails are offloaded to an asynchronous message queue.

```mermaid
sequenceDiagram
    participant User
    participant Gateway as API Gateway
    participant Hotel as Hotel Service
    participant Supabase as PostgreSQL (RPC)
    participant MQ as RabbitMQ
    participant Worker as Notification Worker

    User->>Gateway: POST /hotels/book (JWT)
    Gateway->>Gateway: Validate JWT & Rate Limit
    Gateway->>Hotel: Route Request
    Hotel->>Supabase: Execute `book_room` RPC
    
    activate Supabase
    Supabase->>Supabase: Lock Rows (FOR UPDATE)
    Supabase->>Supabase: Check Availability
    Supabase->>Supabase: Decrement Capacity & Insert Reservation
    Supabase-->>Hotel: Success (Atomic Transaction)
    deactivate Supabase
    
    Hotel->>MQ: Publish `reservation.created` Event
    Hotel-->>Gateway: 200 OK Response
    Gateway-->>User: Reservation Confirmed!
    
    %% Asynchronous Processing
    MQ->>Worker: Consume Event Message
    activate Worker
    Worker->>Worker: Parse Payload & Dispatch Resend Email API
    Worker-->>MQ: Ack Message
    deactivate Worker
```

### 2. The Autonomous AI Agent Flow

The Agent Service employs a highly robust "Dynamic Tool Registry" architecture. Rather than hardcoding LLM capabilities, tools (like `searchHotels` or `bookRoom`) are built as modular files. The LLM is **never** given direct database access; instead, it securely executes internal backend REST calls on behalf of the user using their delegated JWT token.

```mermaid
sequenceDiagram
    participant User
    participant Gateway as API Gateway
    participant Agent as Agent Service
    participant LLM as Cerebras
    participant Hotel as Hotel Service

    User->>Gateway: POST /agent/chat "Book a room in Rome"
    Gateway->>Agent: Route Request
    Agent->>LLM: Send Prompt + Registered Tool Schemas
    
    activate LLM
    LLM-->>Agent: Function Call Request: `searchHotels(Rome)`
    deactivate LLM
    
    Agent->>Hotel: Internal API Call /hotels/search?city=Rome
    Hotel-->>Agent: JSON Response (Hotels in Rome)
    
    Agent->>LLM: Return Tool Output (Hotel JSON)
    
    activate LLM
    LLM-->>Agent: Formatted Markdown Response
    deactivate LLM
    
    Agent-->>Gateway: 200 OK (Response Text)
    Gateway-->>User: "I found 3 hotels in Rome! Here they are..."
```

---

## 🗄️ ER Diagram

```mermaid
erDiagram
    user_profiles ||--o{ hotels : "owns (admin)"
    user_profiles ||--o{ reservations : "makes"
    hotels ||--o{ room_types : "has"
    hotels ||--o{ reservations : "receives"
    room_types ||--o{ room_availability : "tracks"
    room_types ||--o{ reservations : "booked in"

    user_profiles {
        uuid id PK "References auth.users"
        string full_name
        string role "user | admin"
        string email
    }
    hotels {
        uuid id PK
        string name
        string city
        string country
        int star_rating
        uuid admin_id FK
    }
    room_types {
        uuid id PK
        uuid hotel_id FK
        string name
        int capacity
        decimal price_per_night
        int total_rooms
    }
    room_availability {
        uuid id PK
        uuid room_type_id FK
        date date
        int available_count
        boolean is_available
    }
    reservations {
        uuid id PK
        uuid user_id FK
        uuid hotel_id FK
        uuid room_type_id FK
        date check_in
        date check_out
        int guests
        string guest_name
        string guest_email
        string status
    }
```
*(Note: Comments are stored separately in MongoDB).*

---

## 🧠 Design Decisions, Assumptions & Issues Encountered

### Design Decisions
*   **Polyglot Persistence**: We intentionally split data across three platforms. PostgreSQL (Supabase) handles strict ACID transactions for reservations. MongoDB handles high-volume, unstructured text data (reviews) to prevent locking relational tables. Redis handles high-speed read caching.
*   **Atomic Booking RPC**: To completely eliminate race conditions and double-booking, the reservation logic is pushed down to the database layer via a PostgreSQL Stored Procedure (`book_room`) utilizing `FOR UPDATE` row-level locks.
*   **Event-Driven Notifications**: We used RabbitMQ to decouple the blocking nature of email/notification delivery from the strict atomic booking transaction, ensuring zero-latency API responses for the end user.
*   **Centralized API Gateway**: Implemented the Gateway pattern to centralize JWT validation, Redis rate-limiting, and reverse-proxying. This allows internal microservices to focus purely on business logic.
*   **Dynamic Tool Registration**: The AI Agent's tool capabilities are not hardcoded. We implemented a file-based `ToolRegistry` using Zod schemas, which allows adding new capabilities to the LLM by simply dropping a new file in the tools folder.
*   **Graceful Degradation (Rate Limiting)**: Designed the API Gateway to seamlessly fall back to an in-memory rate limiter if the Redis instance becomes temporarily unavailable, ensuring endpoints remain protected from DDoS.

### Assumptions
*   **Trusted Internal Network**: We assumed the API Gateway acts as a Zero-Trust boundary. Internal microservices trust requests routed from the Gateway, though PostgreSQL Row Level Security (RLS) is still enforced as defense-in-depth.
*   **Serverless Cron Triggering**: We assumed that background audits (like the 20% capacity check) are best triggered passively via external cron jobs (Azure Logic Apps) rather than keeping persistent `setInterval` loops running in Node.js, which prevents memory bloat.
*   **Admin Ownership**: We modeled the system assuming a 1-to-1 or 1-to-many relationship where a single `admin_id` (tied to a Supabase User) owns and manages specific hotel inventories.
*   **Synchronous LLM Execution**: We assumed the UI can wait for standard HTTP requests to finish while the Agent executes multi-hop backend function calls, opting against complex WebSocket streaming for V1.

### Issues Encountered & Resolved
*   **AI Agent Rate Limiting**: 
    *   *Issue*: During testing, the Google Gemini API frequently triggered `429 Too Many Requests` due to free-tier constraints during complex tool-calling loops.
    *   *Solution*: Migrated the `agent-service` orchestrator to the **Cerebras Cloud SDK** using the `gpt-oss-120b` model, resulting in significantly faster inference and bypassing the rate limits.
*   **Docker vs Host DNS Resolution in Frontend**:
    *   *Issue*: The Vite frontend proxy encountered `net::ERR_NAME_NOT_RESOLVED` when the browser tried to hit `http://gateway:3000` directly, as `gateway` is a Docker-internal network alias unresolvable by the host machine's browser.
    *   *Solution*: Refactored `docker-compose.yml` and startup scripts to explicitly inject `VITE_GATEWAY_URL=http://localhost:3000`, ensuring the client-side fetch requests route correctly through the host's port bindings.
*   **Stale Cache Reads**: 
    *   *Issue*: After a room was booked, the UI would sometimes still show the old availability count due to Redis caching.
    *   *Solution*: Implemented explicit `redis.del()` invalidation hooks on the `search:*` and `hotel:details:*` wildcard keys immediately upon a successful reservation commit.
*   **Database Schema Drift**:
    *   *Issue*: The original SQL schema incorrectly included a relational `comments` table, violating the polyglot persistence design.
    *   *Solution*: Dropped the relational comments table to strictly isolate review logic to MongoDB.

---

## 🏛️ Service Details



### 1. API Gateway (`services/gateway`)
The central nervous system and zero-trust barrier of the application. Built with Node.js and Express, it is the *only* backend service exposed to the public internet.
*   **Authentication Interceptor & Caching**: Intercepts `Authorization: Bearer <token>` headers, validates them against Supabase Auth, and aggressively caches the validation in Redis for 5 minutes. This drastically reduces network roundtrips to the identity provider and accelerates authenticated requests.
*   **Fault-Tolerant Rate Limiting**: Utilizes `express-rate-limit` backed by Redis to enforce strict request quotas across all services. It features a graceful fallback mechanism: if Redis goes down, it seamlessly falls back to memory-based limiting, ensuring the backend is never left unprotected.
*   **Reverse Proxy & Request Sanitization**: Uses `http-proxy-middleware` to securely route requests to internal microservices based on URL paths (`/api/v1/hotels`, `/api/v1/comments`, etc.).

### 2. Hotel Service (`services/hotel-service`)
The core transactional engine for the platform.
*   **Atomic Booking RPC**: Utilizes a PostgreSQL Stored Procedure (`book_room`) and row-level locking (`FOR UPDATE`) to ensure zero race conditions or double-bookings, even under heavy concurrent load.
*   **Aggressive Caching**: Interacts directly with Upstash Redis to aggressively cache hotel search results and property details, drastically reducing latency for read-heavy operations.
*   **Event Publishing**: Securely publishes robust, structured JSON messages to the CloudAMQP queue the exact moment a booking transaction successfully commits, enabling decoupled downstream processing.

### 3. Comments Service (`services/comments-service`)
A dedicated NoSQL microservice built for scale.
*   **MongoDB Atlas Connection Pooling**: Implements intelligent connection pooling (`cachedClient`) to maintain a persistent, high-throughput connection to the database across containerized environments.
*   **Traffic Isolation**: Decoupling user reviews into MongoDB prevents heavy, read-intensive query loads from locking the relational PostgreSQL transactional tables where bookings happen.
*   **Data Integrity & Redis Sync**: Actively updates and invalidates aggregated hotel ratings in the Redis cache immediately upon comment deletion or creation to ensure UI speed without sacrificing data freshness.

### 4. Notification Worker (`services/notification-worker`)
The asynchronous background processor ensuring system resilience.
*   **Dedicated Consumer Architecture**: Runs continuously as a background Node.js process (not an HTTP server). It maintains a persistent connection to CloudAMQP with exponential backoff and reconnection logic.
*   **Zero-Blocking UI**: By consuming the RabbitMQ queue, it handles the heavy lifting of parsing payloads and simulating external side-effects (like emails) asynchronously.
*   **Automated Scheduling Integration**: The `capacity_check_logic_app.json` file contains an Azure Logic App workflow definition. It acts as a serverless cron job that wakes up nightly to:
    1. Hit the auditing endpoint (`/api/v1/notifications/capacity-check`). If any room type's 30-day availability falls below 20%, it alerts the hotel admin.
    2. Hit the queue processing endpoint (`/api/v1/notifications/process-queue`) to passively pull any unhandled new hotel reservations from RabbitMQ and dispatch confirmation emails.

### 5. Agent Service (`services/agent-service`)
The autonomous AI orchestrator.
*   **Dynamic Tool Registry**: Uses file-based dynamic loading to securely register deterministic backend functions (tools) that the Cerebras LLM can execute.
*   **Contextual Booking**: Translates natural language intent ("Book me a room in Rome") directly into secure, backend-to-backend API calls using the user's forwarded JWT token.

---

## ⚡ Caching Strategy & Data Models

Hotello utilizes **Upstash Redis** to drastically reduce database latency. The architecture relies on specific key prefixes to intelligently invalidate data when state changes:

*   `token:<JWT_STRING>`: Caches Supabase User IDs for 5 minutes to avoid redundant Auth API calls on every request.
*   `search:<QUERY_HASH>`: Caches the results of complex hotel searches. These are invalidated dynamically when inventory changes.
*   `hotel:details:<HOTEL_ID>`: Stores the full aggregate profile of a hotel, including its Mongo-based review score and Postgres-based room types.
*   `rl:hourly:user:<USER_ID>` & `rl:daily:ip:<IP_ADDRESS>`: Used by the Gateway's sliding-window rate limiters to track request quotas.

**Invalidation Flow**: When a user books a room via the `Hotel Service`, the backend explicitly runs `redis.del()` on all `search:*` and `hotel:details:*` keys associated with that property to prevent stale availability data from being served.

---

## 🔒 Security & Authentication Model

The entire ecosystem relies on **JWT (JSON Web Tokens)** managed by Supabase Auth.

1.  **Client-Side**: The React UI authenticates the user and retrieves a short-lived Access Token.
2.  **Gateway-Side**: Every request must pass through the API Gateway, which intercepts the `Authorization` header, cryptographically verifies the JWT, and attaches the parsed `req.user` object to the request.
3.  **Service-Side**: The internal microservices trust the Gateway.
4.  **Database-Side (RLS)**: Supabase PostgreSQL implements strict Row Level Security (RLS). Even if a malicious user bypasses the API, the database will forcefully reject `UPDATE` or `DELETE` commands unless the JWT proves the user owns the specific reservation row (`user_id = auth.uid()`).
5.  **Role-Based Access Control (RBAC)**: Certain endpoints (like modifying hotel inventory) enforce an Admin check, verifying that the user's UUID matches the `admin_id` of the target hotel.

---

## 📡 API Endpoints Overview

All external requests hit the API Gateway, which forwards them to the underlying microservices.

| Method | Endpoint Path | Target Service | Auth Req. | Description |
| :--- | :--- | :--- | :---: | :--- |
| **GET** | `/api/v1/hotels/search` | Hotel Service | ❌ | Returns filtered and cached hotel lists |
| **GET** | `/api/v1/hotels/:id` | Hotel Service | ❌ | Returns aggregate hotel details & rooms |
| **POST** | `/api/v1/hotels/book` | Hotel Service | ✅ | Executes atomic `book_room` RPC transaction |
| **GET** | `/api/v1/hotels/reservations/me` | Hotel Service | ✅ | Retrieves user's booking history |
| **GET** | `/api/v1/comments/:hotelId` | Comments Service | ❌ | Fetches paginated MongoDB reviews |
| **POST** | `/api/v1/comments` | Comments Service | ✅ | Posts a new review and updates Redis |
| **POST** | `/api/v1/agent/chat` | Agent Service | ❌* | Connects to the Cerebras AI Orchestrator |

*\*The Agent Service allows anonymous chat, but if the user provides a JWT, the Agent assumes their identity to perform authenticated actions (like booking).*

---

## 🚀 Future Scalability

The decoupled nature of Hotello allows for seamless horizontal scaling:
*   **Load Balancing**: If search traffic spikes, we can spin up multiple instances of the `Hotel Service` behind a round-robin load balancer without needing to scale the `Comments Service`.
*   **Event Sourcing Expansion**: The RabbitMQ integration currently handles notifications, but it is primed for Event Sourcing. Future workers could consume `reservation.created` events to sync data to a Data Warehouse (e.g., Snowflake) for business intelligence without touching the core transactional database.

---

## ⚙️ Local Development Setup

You can spin up the entire microservices architecture locally using Docker Compose.

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local UI testing)

### 1. Environment Configuration
Create a `.env` file in the root directory. You must supply your own cloud connection strings for the managed stateful services.
```env
# Supabase (PostgreSQL & Auth)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Upstash Redis Cloud
REDIS_URL=rediss://default:your-password@your-redis-url:port

# CloudAMQP (RabbitMQ)
CLOUDAMQP_URL=amqps://user:pass@host/vhost

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# Cerebras Inference AI
CEREBRAS_API_KEY=your-cerebras-key

# Google Gemini AI (Optional Fallback)
GEMINI_API_KEY=your-gemini-key

# Resend Transactional Email API
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### 2. Run the Stack
Run the following command from the root directory:
```bash
docker-compose up --build
```
This will build and start all 6 containers.
*   **API Gateway**: `http://localhost:3000`
*   **UI Application**: `http://localhost:5173`

---

## ☁️ Cloud Deployment Strategy

The application is designed to be deployed to **Render**.

1. **Web Services (Backend)**: Deploy `hotel-service`, `comments-service`, and `agent-service` as public Web Services (Docker environment).
2. **Background Worker**: Deploy `notification-worker` as a Background Worker (Docker environment). It will continuously consume RabbitMQ without needing an open web port.
3. **Web Service (Gateway)**: Deploy the `gateway` as a public Web Service. You must configure its environment variables (`HOTEL_SERVICE_URL`, `COMMENTS_SERVICE_URL`, etc.) to point to the live Render URLs of the backend web services.
4. **Static Site (Frontend)**: Deploy the `ui` folder as a Static Site. Set the Build Command to `npm install && npm run build` and the Publish Directory to `dist`. Add a Rewrite Rule (`Source: /*`, `Destination: /index.html`) to support React Router SPA navigation.
