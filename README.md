# Petty Cash Management System - Backend

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB installed locally or MongoDB Atlas account

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration

4. Start the server:
```bash
npm run dev
```

## Project Structure
```
backend/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── utils/          # Utility functions
└── server.js       # Entry point
```

## API Endpoints (Coming in Phase 3)
- `/api/auth` - Authentication
- `/api/transactions` - Transaction management
- `/api/users` - User management
- `/api/categories` - Category management
- `/api/reports` - Reports and analytics
