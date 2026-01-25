# Petty Cash Management System

A full-stack web application for managing petty cash transactions with approval workflows.

## 🎯 Project Features

### Core Functionality

- ✅ User authentication and authorization
- ✅ Transaction management (Create, Read, Update, Delete)
- ✅ Multi-level approval workflow
- ✅ Category management
- ✅ Receipt upload and management
- ✅ Reports and analytics
- ✅ Dashboard with real-time statistics
- ✅ Search and filter transactions
- ✅ Export data to CSV/PDF

### User Roles

1. **Employee** - Submit expense requests
2. **Manager** - Approve/reject requests
3. **Finance** - Final approval and disbursement
4. **Admin** - System configuration

## 🏗️ Tech Stack

### Frontend

- React 18
- Vite
- TailwindCSS
- React Router
- Axios
- Recharts (for analytics)

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Multer (file uploads)

## 📋 Development Phases

### ✅ Phase 1: Project Setup & Architecture (COMPLETED)

- Project structure created
- Frontend and backend initialized
- Dependencies configured

### 🔄 Phase 2: Database Design & Schema (NEXT)

- User model
- Transaction model
- Category model
- Approval workflow model

### ⏳ Phase 3: Backend API Development

- Authentication APIs
- Transaction CRUD APIs
- Approval workflow APIs
- Report generation APIs

### ⏳ Phase 4: Frontend UI Development

- Dashboard UI
- Transaction forms
- Approval interface
- Reports page

### ⏳ Phase 5: Integration & Testing

- Connect frontend to backend
- State management
- Form validation
- Unit and integration tests

### ⏳ Phase 6: Deployment & Documentation

- Cloud deployment
- API documentation
- User manual

## 🚀 Quick Start

### Prerequisites

- Node.js v16+
- MongoDB (local or Atlas)
- Git

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
petty-cash-app/
├── backend/
│   ├── config/         # Database & app config
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── utils/          # Helper functions
│   └── server.js       # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── context/    # State management
│   │   ├── utils/      # Utilities
│   │   └── App.jsx     # Main component
│   └── public/         # Static files
└── README.md
```

## 🔗 API Endpoints (Coming in Phase 3)

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

### Transactions

- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/:id` - Get single transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Approvals

- `POST /api/transactions/:id/approve` - Approve transaction
- `POST /api/transactions/:id/reject` - Reject transaction

### Reports

- `GET /api/reports/summary` - Get summary report
- `GET /api/reports/export` - Export transactions

## 👥 Contributing

This is a learning project. Follow the phase-by-phase development approach.

## 📝 License

ISC

---

**Current Phase:** Phase 1 Complete ✅  
**Next Phase:** Phase 2 - Database Design & Schema
