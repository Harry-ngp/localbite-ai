# 🍔 LocalBite AI

<div align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/HuggingFace-F9AB00?style=for-the-badge&logo=huggingface&logoColor=white" alt="HuggingFace" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
</div>

<br/>

**LocalBite AI** is an intelligent, real-time hyperlocal logistics and food delivery platform designed for Tier-2/3 cities and rural delivery ecosystems. It bridges the gap between hungry customers, local partner kitchens, and delivery riders using a unified, event-driven architecture.

## ✨ Features

- **Real-Time WebSocket Sync:** Live order tracking, instantaneous status updates, and live GPS map tracking.
- **AI Geocoding & NLP:** Uses HuggingFace Natural Language Processing (NER) to intelligently parse unstructured addresses and extract local landmarks to determine accurate coordinates even without formal street addresses.
- **Unified Marketplace:**
  - 🛍️ **Customer App:** Discover local menus, place orders, and track your delivery in real-time on an interactive map.
  - 👨‍🍳 **Partner Kitchen App:** Accept incoming orders, manage preparation statuses, and notify riders when food is ready.
  - 🛵 **Rider App:** Accept delivery requests, track earnings, and trigger live GPS simulations as you head to the destination.
- **Automated Workflow Monitoring:** A background engine constantly monitors the database for stuck or delayed orders, gracefully rolling them back to the queue or cancelling them to ensure optimal bandwidth and service quality.

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Frontend "React SPA (TailwindCSS)"
        C[Customer App]
        P[Partner App]
        R[Rider App]
    end

    subgraph Backend "FastAPI API Gateway"
        API[REST API Routes]
        WS[WebSocket Connection Manager]
        NLP[HuggingFace NER Geocoding]
        MON[Background Stuck Order Monitor]
    end

    subgraph Database
        DB[(Supabase PostgreSQL)]
    end

    C <--> |REST / WS| API
    C <--> |WS| WS
    P <--> |REST / WS| API
    P <--> |WS| WS
    R <--> |REST / WS| API
    R <--> |WS| WS

    API --> |Address Text| NLP
    API <--> |CRUD| DB
    MON --> |Poll 30s| DB
    MON --> |Alert Rollbacks| WS
```

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Supabase Account

### 1. Database Setup
Create a new project on [Supabase](https://supabase.com/). You will need the Connection Pooling `DATABASE_URL` (usually on port 6543 for IPv4 compatibility).

### 2. Backend Setup
```bash
cd backend/api-gateway
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt

# Create your .env file
echo "DATABASE_URL=your_supabase_connection_string" > .env

# Initialize the database tables and run the server
python reset_db.py
uvicorn app.main:app --reload
```
The API will be running at `http://127.0.0.1:8000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The App will be running at `http://localhost:5173`.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.