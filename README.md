# 🗺️ Ghumakkars - Premium Budget Travel for Students

A modern, budget-friendly travel platform designed exclusively for Indian university students. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- ✨ Modern, student-focused design
- 🎨 Beautiful UI with Tailwind CSS and Lucide icons
- 🚀 Built with Next.js 14 (App Router)
- 📱 Fully mobile responsive
- 🎯 Smooth animations and transitions
- 🔐 Supabase authentication (Sign Up & Sign In)
- 👨‍💼 Admin dashboard for trip management
- 💰 Budget-friendly pricing with discounts
- 📊 Dynamic trip listings from database
- 👥 Group booking support

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd "Ghumakkars 2"
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up Supabase:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the SQL from `supabase-schema.sql`
   - Go to Settings > API to get your credentials

4. **Configure environment variables:**
   - Create a `.env.local` file in the root directory
   - Add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. **Set up an admin user:**
   - Sign up through the website
   - In Supabase dashboard, go to Table Editor > profiles
   - Find your user and set `role` to `'admin'`

6. **Run the development server:**
```bash
npm run dev
```

7. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Project Structure

```
.
├── app/
│   ├── admin/            # Admin dashboard
│   ├── auth/             # Authentication pages
│   │   ├── signin/       # Sign in page
│   │   └── signup/       # Sign up page
│   ├── trips/            # Trip detail pages
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/
│   ├── Navbar.tsx        # Navigation bar
│   ├── Footer.tsx        # Footer component
│   ├── Hero.tsx          # Hero section
│   ├── Trips.tsx         # Trip listings
│   └── About.tsx         # About section
├── lib/
│   └── supabase/         # Supabase client utilities
├── supabase-schema.sql   # Database schema
└── package.json
```

## Key Features Explained

### Authentication
- Users can sign up and sign in
- Profile creation on signup
- Role-based access (user/admin)

### Admin Dashboard
- Create, edit, and delete trips
- Set pricing, discounts, and details
- Manage trip availability

### Trip Management
- Dynamic trip listings from database
- Trip detail pages with booking
- Price display with discounts
- Participant tracking

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend (Auth + Database)
- **Lucide React** - Icon library
- **React Hook Form** - Form handling

## Database Schema

The application uses three main tables:
- `trips` - Stores trip information
- `bookings` - Stores user bookings
- `profiles` - Stores user profile data

See `supabase-schema.sql` for complete schema.

## Customization

- Update colors in `tailwind.config.ts`
- Modify trip structure in Supabase
- Customize components in `components/` directory
- Update branding in all component files

## Build for Production

```bash
npm run build
npm start
```

## Important Notes

- Make sure to set up Supabase RLS policies correctly
- Admin users need `role = 'admin'` in profiles table
- Image URLs in trips should be publicly accessible
- Configure email templates in Supabase for authentication

## License

This project is open source and available under the MIT License.
