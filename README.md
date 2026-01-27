# 🟢 Petty Cash Backend API

Node.js/Express REST API with MongoDB, JWT authentication, file uploads, and email notifications.

## 🚀 Quick Start

### Prerequisites

- Node.js v16+
- MongoDB Atlas account (free) or local MongoDB
- Gmail account for email notifications

### Installation

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and credentials
npm run seed      # Seed initial data
npm run dev       # Start server on http://localhost:5000
```

### Environment Variables (.env)

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/petty_cash_db
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRE=7d
NODE_ENV=development

# Gmail Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-digit-app-password
EMAIL_FROM="Pettyca$h <noreply@company.com>"

CEO_EMAIL=ceo@company.com
FRONTEND_URL=http://localhost:3001
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

### Get Gmail App Password

1. Enable 2-Step Verification in Google Account
2. Go to Security > App passwords
3. Generate password for "Mail"
4. Use the 16-digit password in .env

## 📦 Available Scripts

```bash
npm run dev        # Development with nodemon
npm start          # Production server
npm run seed       # Seed all data (users, categories, transactions)
npm run seed:otp   # Generate OTP for testing
npm test           # Run tests
```

## 🗂️ Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   ├── authController.js    # Login, OTP verification
│   ├── userController.js    # User CRUD
│   ├── transactionController.js  # Transaction management
│   ├── categoryController.js
│   ├── reportController.js  # Excel/PDF reports
│   └── fundTransferController.js
├── middleware/
│   ├── authMiddleware.js    # JWT verification
│   ├── auditMiddleware.js   # Activity logging
│   └── uploadMiddleware.js  # Multer file upload
├── models/
│   ├── User.js              # User schema with roles
│   ├── Transaction.js       # Transaction with approval
│   ├── Category.js
│   ├── OTP.js               # One-time passwords
│   ├── FundTransfer.js
│   ├── Balance.js
│   ├── AuditLog.js
│   └── UserActivityLog.js
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── transactionRoutes.js
│   ├── categoryRoutes.js
│   ├── reportRoutes.js
│   └── fundTransferRoutes.js
├── services/
│   ├── otpService.js        # OTP generation/verification
│   ├── notificationService.js  # Email sending
│   └── reportService.js     # Excel/PDF generation
├── utils/
│   ├── jwtUtils.js          # Token generation
│   └── fileUtils.js         # File validation
├── uploads/                 # Receipt storage
│   ├── invoices/
│   └── payments/
├── server.js                # Express app entry
├── seedData.js              # Database seeding
├── .env.example             # Environment template
├── vercel.json              # Vercel deployment
├── Procfile                 # Heroku deployment
└── .nvmrc                   # Node version (v16)
```

## 🔗 API Endpoints

### Authentication

- `POST /api/auth/login` - Login & send OTP
- `POST /api/auth/verify-otp` - Verify OTP & get JWT
- `POST /api/auth/resend-otp` - Resend OTP email
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/me` - Get current user info

### Users (Admin only)

- `GET /api/users` - List all users
- `POST /api/users` - Create user & send invitation
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/resend-invitation` - Resend invitation

### Transactions

- `GET /api/transactions` - List (filters: status, category, user, date)
- `POST /api/transactions` - Create with receipt upload
- `GET /api/transactions/:id` - Get details
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `POST /api/transactions/:id/approve` - Approve (Manager only)
- `POST /api/transactions/:id/reject` - Reject with reason

### Categories

- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Reports

- `GET /api/reports/summary` - Dashboard statistics
- `GET /api/reports/export` - Export to Excel
- `POST /api/reports/ceo` - Email report to CEO

### Fund Transfers

- `GET /api/fund-transfers` - List transfers
- `POST /api/fund-transfers` - Create transfer
- `DELETE /api/fund-transfers/:id` - Delete transfer

### Health

- `GET /api/health` - Health check

## 🌐 Deployment

### Vercel (Serverless)

```bash
npm install -g vercel
vercel --prod
```

### Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Heroku

```bash
heroku create petty-cash-api
git push heroku main
heroku config:set MONGODB_URI=<your-uri>
```

## 🔒 Security

- JWT authentication with 7-day expiry
- Bcrypt password hashing
- OTP verification via email
- Role-based access control
- File upload validation (5MB limit)
- CORS protection
- Rate limiting ready
- Audit logging

## 🧪 Testing

```bash
npm test
```

Test with default seeded users:

- Admin: admin@company.com / Admin@123
- Manager: manager@company.com / Manager@123
- Employee: employee@company.com / Employee@123

## 📝 Seeded Data

After running `npm run seed`:

- 3 users (Admin, Manager, Employee)
- 10 categories (Travel, Office Supplies, etc.)
- Sample transactions
- Initial balance

## 🐛 Troubleshooting

**MongoDB Connection Failed**

- Check MongoDB URI format
- Whitelist IP in Atlas (0.0.0.0/0 for all)
- Verify username/password

**Email Not Sending**

- Use Gmail app password (not regular password)
- Enable "Less secure app access" if needed
- Check EMAIL_USER and EMAIL_PASSWORD

**Port Already in Use**

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```

## 📄 License

ISC
