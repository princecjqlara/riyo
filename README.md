# Baratillo - Image-Based Price Lookup System

A complete web application that allows users to find product prices by taking photos. Built with Next.js, Supabase, and TensorFlow.js.

## Features

- 📸 **Image Search**: Take photos or upload images to find product prices
- 🔐 **Authentication**: Admin and Staff role-based access control
- 📦 **Product Management**: Full CRUD operations for inventory management
- 🎯 **AI Recognition**: TensorFlow.js-based image similarity matching
- 📊 **Accuracy Tools**: Admin tools to improve search accuracy for similar products
- 🖼️ **Multiple Images**: Support for multiple images per product with different angles
- 🔍 **Similar Products**: Mark and manage similar products with distinguishing features

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Storage + Auth)
- **Image Recognition**: TensorFlow.js (MobileNetV3)
- **Hosting**: Vercel (Free Tier)

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- npm or yarn package manager

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   - `supabase/migrations/001_initial_schema.sql`
3. Create a storage bucket named `product-images`:
   - Go to Storage → Create Bucket
   - Name: `product-images`
   - Make it public for image access
4. Get your Supabase credentials:
   - Project URL
   - Anon Key
   - Service Role Key (for admin operations)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Create Initial Admin Account

After running the migration, create your first admin user:

1. Go to Supabase Dashboard → Authentication → Users
2. Create a new user manually or use the registration page
3. In SQL Editor, run:

```sql
INSERT INTO user_profiles (id, email, full_name, role)
VALUES (
  'user-uuid-from-auth',
  'admin@example.com',
  'Admin User',
  'admin'
);
```

Replace `user-uuid-from-auth` with the actual user ID from the auth.users table.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
baratillo/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin pages
│   ├── staff/             # Staff pages
│   ├── api/               # API routes
│   └── search/            # Public search page
├── components/            # React components
│   ├── admin/            # Admin components
│   ├── auth/             # Authentication components
│   ├── search/           # Search components
│   └── shared/           # Shared components
├── lib/                  # Utility libraries
│   ├── supabase/        # Supabase clients
│   ├── tensorflow.ts    # TensorFlow.js utilities
│   └── embeddings.ts     # Embedding generation
├── hooks/                # React hooks
├── types/                # TypeScript types
└── supabase/            # Database migrations
```

## Usage

### For Users (Public)

1. Go to the home page
2. Click "Start Searching"
3. Take a photo or upload an image
4. View matching products with prices

### For Staff

1. Login with staff credentials
2. Add new products to inventory
3. Edit products you created
4. View all products

### For Admin

1. Login with admin credentials
2. Full access to all features:
   - Add/Edit/Delete products
   - Manage staff accounts
   - Improve search accuracy
   - View analytics
   - Manage similar products

## Improving Accuracy for Similar Products

When you have two similar products that are often confused:

1. **Add Multiple Images**: Upload images from different angles, especially showing distinguishing features
2. **Mark as Similar**: Go to Admin → Accuracy → Similar Products
3. **Add Distinguishing Features**: Define what makes each product unique
4. **Adjust Thresholds**: Set higher confidence thresholds for similar products
5. **Review Corrections**: Check the corrections queue to learn from mistakes

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

The app will automatically deploy on every push to main branch.

## Free Tier Limits

- **Supabase**: 500MB database, 1GB storage, 50,000 monthly active users
- **Vercel**: 100GB bandwidth/month, unlimited personal projects
- **TensorFlow.js**: No limits (runs client-side)

## Troubleshooting

### Images not uploading
- Check Supabase storage bucket is created and public
- Verify storage policies allow uploads

### Search not working
- Ensure TensorFlow.js model loads correctly
- Check browser console for errors
- Verify embeddings are being generated

### Authentication issues
- Check Supabase Auth is enabled
- Verify RLS policies are set correctly
- Ensure user_profiles table has correct data

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
