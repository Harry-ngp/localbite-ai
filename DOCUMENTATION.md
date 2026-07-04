# LocalBite AI - Complete Technical Documentation

Welcome to the definitive technical documentation for **LocalBite AI**. This document is designed for developers, technical recruiters, and interviewers to understand the complete architecture, data models, feature implementations, and tech stack powering the platform.

---

## 1. Complete Technology Stack

LocalBite AI is built using a modern, event-driven, three-tier architecture that bridges high-performance backend routing with a highly interactive frontend.

### Frontend (Client Tier)
* **React.js & Vite:** The core framework. Vite was chosen over Create React App (CRA) for significantly faster HMR (Hot Module Replacement) and optimized build times.
* **Tailwind CSS:** Used exclusively for styling. It powers the app’s premium aesthetics, including complex gradients, glassmorphism (`backdrop-blur`), and responsive skeleton loaders.
* **React-Leaflet:** Integrates interactive maps to simulate real-time rider GPS tracking without relying on expensive Google Maps API calls during development.
* **Architecture:** Operates as a Single Page Application (SPA) but avoids heavy routing libraries (`react-router-dom`) in favor of state-driven view modes (`viewMode`) to maintain seamless background animations and modal drawer overlays.

### Backend (API & Logic Tier)
* **Python 3 & FastAPI:** Selected for its extreme speed (built on Starlette) and native asynchronous capabilities (`async`/`await`), which are essential for managing concurrent WebSockets and AI requests.
* **WebSockets:** Native FastAPI WebSockets manage persistent, bidirectional connections between Customers, Partners (Restaurants), and Riders to simulate real-time gig-economy logistics.
* **Google Gemini AI API:** Acts as the brain behind the "Anti-Paralysis" search engine, analyzing natural language and abstract moods to recommend dishes.

### Database (Data Tier)
* **SQLAlchemy ORM:** Provides an object-relational mapping layer to securely and efficiently interact with the database using Python classes.
* **SQLite:** Currently used for local development and rapid prototyping. The SQLAlchemy layer ensures it can be instantly swapped to **PostgreSQL** for a production deployment with zero code changes to the API endpoints.

---

## 2. Database Schema & Architecture

The database is highly relational, utilizing PostgreSQL-compatible UUIDs (`UUID(as_uuid=True)`) as primary keys for distributed scaling and security.

### 2.1 Core Entities

1. **`MarketplaceUser` (Users Table)**
   * Centralizes authentication and identity for the entire ecosystem.
   * **Key Columns:** `id`, `name`, `email`, `password_hash`, `role` (defines if they are a 'customer', 'partner', or 'rider').
2. **`Restaurant` (Partner Table)**
   * **Key Columns:** `id`, `name`, `address`, `latitude`, `longitude`, `rating`.
   * **Relationships:** Belongs to a `MarketplaceUser` (Owner). Has many `MenuItems`.
3. **`MenuItem` (Inventory Table)**
   * **Key Columns:** `id`, `restaurant_id`, `name`, `price`, `category`, `is_available`.
4. **`Order` (Logistics Table - The Nervous System)**
   * **Key Columns:** `id` (String UUID), `customer_id`, `restaurant_id`, `rider_id`, `amount`, `item_description`, `status`.
   * **State Machine Statuses:** `pending_assignment` → `accepted` → `preparing` → `assigned` → `in_delivery` → `delivered`.
   * **Volume Logic:** Contains a `volume_units` integer field. This allows riders to calculate if the physical size of an order fits in their delivery bag before accepting it.

### 2.2 In-Memory State Machine (Split Bill)
While static data lives in SQLite, the **Split Bill** collaborative rooms live entirely in Server RAM (In-Memory Dictionaries).
* **Why RAM?** SQLite is not optimized for high-concurrency real-time reads/writes. Since a split-bill room only lives for a few minutes while users decide what to eat, storing it in a Python dictionary (`rooms = {}`) ensures lightning-fast read/write speeds when clients short-poll the server every 3 seconds.
* **Garbage Collection:** A lightweight `_gc_rooms()` function runs periodically, checking timestamps and wiping any room older than 2 hours to prevent memory leaks.

---

## 3. Deep Dive: Feature Implementations

### 3.1 AI Anti-Paralysis Engine (Vibe Search)
**Goal:** Cure decision fatigue by allowing users to search via "vibes" (e.g., "lazy late night food under ₹200").

**Implementation Flow:**
1. **Natural Language Parsing:** The user submits a query. A regex pattern (`r'(?:under|below|budget|₹)\s*(\d+)'`) automatically extracts budget constraints.
2. **Keyword Filtering:** The query is stripped and cross-referenced against the `MenuItem` database.
3. **The Tie-Breaker Algorithm:** If the AI finds multiple valid restaurants, the backend runs a mathematical scoring algorithm to declare a winner:
   `Score = (Restaurant Rating * 100) - (Dish Price * 0.1)`
4. **The AI Verdict:** The backend dynamically generates a conversational verdict (e.g., *"Skip scrolling! Go with Truffles because it's cheaper and highly rated."*) and returns it alongside the winner, acting as a virtual concierge.

### 3.2 Collaborative Split Bill Rooms
**Goal:** Allow multiple users on different devices to build a shared cart, calculate totals, and place one group order.

**Implementation Flow:**
1. **Room Creation:** The Host hits `POST /api/v1/split/create`. The backend generates a unique `LB-XXXXXX` code and an active dictionary instance.
2. **Short-Polling:** All connected clients run a React `setInterval` fetching the room state every 3 seconds. This approach was chosen over WebSockets to ensure extreme resilience—if a user on cellular data drops connection for 5 seconds, short-polling guarantees they fetch the correct deterministic state when they reconnect.
3. **Checkout Hijacking:** When the Host clicks "Place Group Order", the frontend intercepts the normal checkout flow. It formats a combined `item_description` (e.g., `[Host] 1x Burger | [Guest] 1x Fries`) and sends the aggregated `grandTotal` to the main backend `orders` endpoint.

### 3.3 Real-Time WebSockets & Logistics
**Goal:** Keep Customers, Partners, and Riders perfectly synchronized without page refreshes.

**Implementation Flow:**
1. **Connection Manager:** `core/websocket.py` maintains an active registry of connected WebSockets, categorized by `role`.
2. **Event Triggers:** When a Partner clicks "Accept Order" on their React dashboard, a REST API call updates the DB. Immediately after the DB commits, the backend triggers `manager.broadcast_to_customer(customer_id, {"type": "order_accepted"})`.
3. **Map Rendering:** The Customer's React app hears this payload. It flips `orderFlow.restaurantAccepted` to `true`.
4. **GPS Simulation:** When `riderAssigned` becomes true, the `MapContainer` mounts. A React `useEffect` loops through an array of hardcoded latitude/longitude coordinates, updating the `riderLocation` state every 4 seconds. This physically moves the Leaflet marker across the map, simulating real-time GPS telemetry.

### 3.4 Dynamic Surge Pricing & Smart Pairing
* **Smart Pairing (Frontend AI):** The `CustomerScreen.jsx` maintains a static `PAIRING_MAP`. Every time the cart updates, it scans the cart strings. If it detects "pizza", it instantly mounts an "AI Perfect Pairing" UI card suggesting "Garlic Bread", allowing 1-click add-ons to increase AOV (Average Order Value).
* **Surge Pricing (Time-Based):** The frontend checks the user's local system time (`new Date().getHours()`). If the hour falls between peak times (12:00-14:00 or 19:00-21:00), the base delivery fee automatically increases from ₹40 to ₹60, and a red `🔥 SURGE` badge renders in the cart.

---

## 4. Summary for Technical Interviews

When discussing this project with interviewers, emphasize that **LocalBite AI is not just a CRUD application; it is a complex, multi-sided marketplace.**

You successfully engineered three distinct interfaces (Customer, Partner, Rider) that must stay perfectly synchronized. You utilized WebSockets for low-latency logistics tracking, but cleverly opted for in-memory short-polling for the Split Bill room to prevent race conditions and ensure mobile network resilience. Furthermore, you didn't just use AI as a chatbot—you deeply integrated it as an "Anti-Paralysis" decision engine that solves a real-world UX problem by parsing budgets and running mathematical tie-breaker algorithms against a local SQL database.
