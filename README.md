# KASHPOS v1.0 - Sales Tracking System

A modern, responsive Sales Tracking System built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

![KASHPOS](https://img.shields.io/badge/KASHPOS-v1.0-green)

## Features

- **🔐 Role-Based Access**
  - Owner (Admin): Full access to all features
  - Cashier: Sales only

- **🛒 Sales**
  - Direct inventory item selection with image preview
  - Custom quantity input (pieces)
  - Customer type selection
  - Payment method selection
  - Dine In/Takeout option (configurable)
  - Cart functionality with real-time totals
  - Payment and change calculation

- **📊 Reports**
  - Daily sales reports
  - Date picker for historical data
  - Editable fields (payment method, customer type, dine in/takeout)
  - Multi-select archive with CSV export

- **📦 Inventory**
  - Product management (CRUD)
  - Image upload with automatic compression (100x100px, max 150KB)
  - Stock tracking by pieces
  - Cost and selling price management
  - Automatic profit calculation

- **💰 Earnings**
  - Daily profit calculations
  - Revenue, cost, and profit summary
  - OPEX tracking with break-even analysis
  - Pie charts: Customer types, Payment methods, Dine In/Takeout
  - Line graphs for date range analysis

- **📋 OPEX Management**
  - Monthly operating expenses tracking
  - Target sales configuration
  - Break-even point monitoring

- **⚙️ Settings**
  - Toggle Dine In/Takeout option
  - Custom payment methods with colors
  - Custom customer types with colors

- **🔔 Notifications**
  - Storage warning (Supabase free tier)
  - New purchase alerts with 1-minute cancel window

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Charts**: Chart.js + react-chartjs-2
- **Notifications**: react-hot-toast
- **Image Compression**: browser-image-compression

## Setup Instructions

### 1. Clone and Install

```bash
cd "KashPOS v1"
npm install
```

### 2. Create Environment File

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Setup Supabase Database

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-schema.sql` and run it
4. Create a storage bucket:
   - Go to **Storage** in the sidebar
   - Click **New bucket**
   - Name: `product-images`
   - Check **Public bucket**
   - Click **Create bucket**

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Login Credentials

| Role    | Username | Password |
|---------|----------|----------|
| Owner   | Admin    | Admin    |
| Cashier | Cashier  | Cashier  |

## Deploying to Vercel

### Option 1: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click **Add New Project**
4. Import your GitHub repository
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click **Deploy**

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

## Project Structure

```
KashPOS v1/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── LoginPage.tsx
│   │   ├── Navigation.tsx
│   │   ├── NotificationBar.tsx
│   │   └── pages/
│   │       ├── EarningsPage.tsx
│   │       ├── InventoryPage.tsx
│   │       ├── OPEXPage.tsx
│   │       ├── ReportsPage.tsx
│   │       ├── SalesPage.tsx
│   │       └── SettingsPage.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── NotificationContext.tsx
│   ├── lib/
│   │   └── supabase.ts
│   └── types/
│       └── database.ts
├── supabase-schema.sql
├── package.json
├── tailwind.config.js
└── README.md
```

## Supabase Free Tier Limits

- **Database**: 500MB
- **Storage**: 1GB
- **Bandwidth**: 2GB/month
- **API Requests**: Unlimited

The app includes a storage warning notification when approaching limits.

## License

MIT License

---

Built with ❤️ using Next.js and Supabase
