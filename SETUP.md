# Quick Setup Guide for Ghumakkars

## Step 1: Set Up Supabase

1. **Create a Supabase Account:**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up for a free account
   - Create a new project

2. **Get Your API Credentials:**
   - In your Supabase project dashboard, go to **Settings** → **API**
   - Copy the following:
     - **Project URL** (under "Project URL")
     - **anon/public key** (under "Project API keys")

3. **Set Up Environment Variables:**
   - Open the `.env.local` file in the root directory
   - Replace the placeholder values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 2: Set Up Database

1. **Run the Database Schema:**
   - In Supabase dashboard, go to **SQL Editor**
   - Click **New Query**
   - Copy the entire contents of `supabase-schema.sql`
   - Paste it into the SQL Editor
   - Click **Run** (or press Ctrl+Enter)

2. **Verify Tables Created:**
   - Go to **Table Editor** in Supabase dashboard
   - You should see three tables:
     - `trips`
     - `bookings`
     - `profiles`

## Step 3: Create Your Admin Account

1. **Start the Development Server:**
   ```bash
   npm run dev
   ```

2. **Sign Up:**
   - Go to [http://localhost:3000](http://localhost:3000)
   - Click **Sign Up** in the navigation
   - Create your account with email and password

3. **Make Yourself Admin:**
   - Go to Supabase dashboard → **Table Editor** → **profiles**
   - Find your user (by email or user ID)
   - Click to edit the row
   - Change the `role` field from `'user'` to `'admin'`
   - Save the changes

4. **Access Admin Dashboard:**
   - Sign out and sign back in (to refresh your session)
   - You should now see an **Admin** link in the navigation
   - Click it to access the admin dashboard

## Step 4: Create Your First Trip

1. **Go to Admin Dashboard:**
   - Navigate to `/admin` (or click Admin in navigation)

2. **Click "Add New Trip"**

3. **Fill in Trip Details:**
   - Title: e.g., "Budget Goa Trip for Students"
   - Description: Detailed description of the trip
   - Destination: e.g., "Goa, India"
   - Original Price: e.g., 15000
   - Discounted Price: e.g., 8999
   - Duration (Days): e.g., 4
   - Max Participants: e.g., 30
   - Start Date: Select a date
   - Image URL: (Optional) URL to a trip image

4. **Click "Create Trip"**

5. **View Your Trip:**
   - Go back to the home page
   - Your trip should appear in the "Budget Trips" section!

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure `.env.local` exists in the root directory
- Check that the values are correct (no extra spaces)
- Restart the dev server after creating/updating `.env.local`

### Error: "relation does not exist"
- Make sure you ran the SQL schema in Supabase SQL Editor
- Check that all tables were created successfully

### Can't access Admin Dashboard
- Make sure you set your role to 'admin' in the profiles table
- Sign out and sign back in to refresh your session
- Check the browser console for any errors

### Trips not showing
- Make sure trips have `is_active = true` in the database
- Check that you're viewing active trips only

## Next Steps

- Add more trips through the admin dashboard
- Customize the design and colors
- Add booking functionality
- Set up email notifications
- Add payment integration

Happy coding! 🚀

