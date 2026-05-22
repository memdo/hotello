# Hotello - AI-Powered Hotel Booking Ecosystem

![Hotello Cover Image](./hotello.png)

**Watch the Demo Video:** [https://drive.google.com/drive/folders/1KzYstbnYhXSYW4l81bVvPUl99Wxmip4V?usp=sharing](https://drive.google.com/drive/folders/1KzYstbnYhXSYW4l81bVvPUl99Wxmip4V?usp=sharing)

### 🌍 Live Deployments
*   **Website (UI)**: [https://hotello-cnxn.onrender.com](https://hotello-cnxn.onrender.com)
*   **API Gateway**: [https://hotello-gateway.onrender.com](https://hotello-gateway.onrender.com)
*   **Hotel Service**: [https://hotello-2u5v.onrender.com](https://hotello-2u5v.onrender.com)
*   **Comments Service**: [https://hotello-comments-service.onrender.com](https://hotello-comments-service.onrender.com)
*   **Agent Service**: [https://hotello-agent-service.onrender.com](https://hotello-agent-service.onrender.com)

---

Hotello is a highly scalable, microservice-based hotel booking platform built for the SE4458 assignment. It demonstrates enterprise-grade architectural patterns, including a custom API Gateway, distributed polyglot persistence (SQL + NoSQL), distributed caching, asynchronous message queuing, and an autonomous AI Agent that utilizes server-side function calling to interact with the platform on behalf of the user.

---

## 🌟 Key Features

*   **Autonomous AI Assistant**: An integrated Chatbot powered by Google's `gemini-2.5-flash` model. It leverages tool-calling (function calling) to search databases and book reservations contextually without user navigation.
*   **Decoupled Microservices**: 5 distinct, Dockerized Node.js services communicating over a unified API Gateway.
*   **Polyglot Persistence**: 
    *   **PostgreSQL (Supabase)** for strictly structured, ACID-compliant relational data (Reservations, Availability).
    *   **MongoDB Atlas** for unstructured, high-throughput document data (User Reviews and Comments).
*   **Distributed Caching**: Upstash Redis Cloud caching for heavy read-operations (Hotel details, JWT sessions) with strict invalidation upon booking.
*   **Asynchronous Message Queuing**: CloudAMQP (RabbitMQ) decouples booking transactions from notification/logging processing to ensure zero-blocking API responses.
*   **Secure API Gateway**: Centralized proxy handling JWT authentication, request routing, and Redis-backed Rate Limiting to prevent DDoS.
*   **Glassmorphism UI**: A premium, responsive React/Vite frontend using modern design tokens and animations.

---

## 🏗️ Architecture Deep Dive

Hotello abandons the traditional monolith in favor of a strictly decoupled, containerized microservices architecture.

### 1. API Gateway (`services/gateway`)
The central nervous system and zero-trust barrier of the application. Built with Node.js and Express, it is the *only* backend service exposed to the public internet.
*   **Authentication Interceptor & Caching**: Intercepts `Authorization: Bearer <token>` headers, validates them against Supabase Auth, and aggressively caches the validation in Redis for 5 minutes. This drastically reduces network roundtrips to the identity provider and accelerates authenticated requests.
*   **Fault-Tolerant Rate Limiting**: Utilizes `express-rate-limit` backed by Redis to enforce strict request quotas across all services. It features a graceful fallback mechanism: if Redis goes down, it seamlessly falls back to memory-based limiting, ensuring the backend is never left unprotected.
*   **Reverse Proxy & Request Sanitization**: Uses `http-proxy-middleware` to securely route requests to internal microservices based on URL paths (`/api/v1/hotels`, `/api/v1/comments`, etc.), ensuring malformed or unauthorized requests never reach the core business logic.

### 2. Hotel Service (`services/hotel-service`)
The core transactional backend responsible for inventory management.
*   **Strict Input Validation**: Utilizes robust middleware checks and clamps data boundaries (e.g., pagination limits, valid UUID enforcement) to prevent injection attacks and ensure data cleanliness.
*   **Atomic Bookings & ACID Guarantees**: To completely eliminate the risk of double-booking and availability drift, reservations are executed entirely within a strict PostgreSQL RPC function (`book_room`). The RPC explicitly checks and decrements daily room capacities in the `room_availability` table using row-level locks (`FOR UPDATE`). This guarantees 100% data integrity within a single atomic transaction.
*   **Event-Driven Architecture**: Instead of blocking user requests to send emails, it immediately publishes `reservation.created` and `reservation.cancelled` events to the RabbitMQ exchange for background processing.

### 3. Comments Service (`services/comments-service`)
A dedicated NoSQL microservice built for scale.
*   **MongoDB Atlas Connection Pooling**: Implements intelligent connection pooling (`cachedClient`) to maintain a persistent, high-throughput connection to the database across serverless or containerized environments.
*   **Traffic Isolation**: Decoupling user reviews into MongoDB prevents heavy, read-intensive query loads from locking the relational PostgreSQL transactional tables where bookings happen.
*   **Data Integrity & Redis Sync**: Actively updates and invalidates aggregated hotel ratings in the Redis cache immediately upon comment deletion or creation to ensure UI speed without sacrificing data freshness.

### 4. Agent Service (`services/agent-service`)
The autonomous AI Orchestrator that gives Hotello its edge.
*   **Dynamic Tool Registry System**: Employs a highly robust, scalable "Tool Registry" architecture. Rather than hardcoding LLM capabilities, tools (like `searchHotels` or `bookRoom`) are built as modular files. The registry dynamically loads these tools at runtime, maps them strictly to Gemini JSON schemas, and binds them to the agent's context. 
*   **Strict LLM Boundary Validation**: The LLM is never given direct database access. The Tool Registry acts as a strict validation boundary, catching hallucinations, validating parameters requested by the AI, and securely executing the internal backend REST calls on behalf of the user using their delegated JWT token.
*   **Stateful Conversation Context**: Maintains an intelligent memory window of previous chat history to provide a seamless, continuous booking experience.

### 5. Notification Worker (`services/notification-worker`)
The asynchronous background processor ensuring system resilience.
*   **Dedicated Consumer Architecture**: Runs continuously as a background Node.js process (not an HTTP server). It maintains a persistent connection to CloudAMQP with exponential backoff and reconnection logic.
*   **Zero-Blocking UI**: By consuming the RabbitMQ queue, it handles the heavy lifting of parsing payloads and simulating email confirmations asynchronously. This guarantees that the user's booking request returns instantly, immune to the latency of slow third-party notification providers.

### 6. Frontend UI (`services/ui`)
*   **Tech**: React 19, Vite, React Router, Tailwind-inspired custom CSS.
*   Uses a global fetch interceptor to automatically route all `/api` requests through the Gateway URL in production environments.

---

## 🛡️ Design Decisions & Risk Mitigation

1. **Dockerization vs Serverless (Risk Mitigated)**: 
   Initially, the project explored using Vercel Serverless Functions. However, a major architectural risk was identified: *pulling continuous streams of messages from RabbitMQ inside a serverless environment risks execution timeouts (e.g., Vercel's 10-second limit)*. 
   To permanently solve this, the architecture was fully **Dockerized**. The backend is now composed of individual Docker containers. The `notification-worker` runs as a continuous, dedicated Node.js process that never times out, ensuring 100% reliable message consumption.
2. **Cloud Networking & Free Tier Constraints**: 
   While a true enterprise architecture would deploy the internal microservices within a Private Network (hidden from the public internet), Render requires a paid plan for Private Services. Therefore, for the scope of this assignment deployment, all microservices are deployed as public **Web Services**. The API Gateway acts as the primary orchestrator and authentication barrier, but the internal services are technically accessible directly due to the free-tier infrastructure limits.

---

## 🗄️ Database Schema (PostgreSQL)

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

# Google Gemini AI
GEMINI_API_KEY=your-gemini-key
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
