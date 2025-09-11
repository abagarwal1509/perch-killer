# Phase 1: "Insider's Edge" Setup Guide

## 🎯 Overview

This guide will help you deploy the complete Phase 1 "Insider's Edge" system for tracking thought leader evolution, starting with Sam Altman as our first featured author.

## 📋 Prerequisites

1. **Supabase Project**: Active Supabase project with authentication enabled
2. **Environment Variables**: Properly configured `.env.local`
3. **Authentication**: User account created in your Supabase auth system

## 🗄️ Step 1: Database Schema Updates

### Option A: Using Supabase SQL Editor (Recommended)

1. Open your Supabase dashboard
2. Go to SQL Editor
3. Run the complete script from `setup-db-manual.sql` (created in project root)
4. This will create:
   - `authors` table for thought leader profiles
   - `author_evolution` table for tracking position changes
   - Enhanced `articles` and `sources` tables with author relationships
   - Proper indexes, RLS policies, and views

### Option B: Using Supabase MCP (If Available)

The MCP integration encountered configuration issues, but once resolved:

```bash
# Example commands (adjust based on your MCP setup)
mcp_supabase_apply_migration "create_authors_system" "$(cat setup-db-manual.sql)"
```

## 🚀 Step 2: Application Setup

### Start the Development Server

```bash
npm run dev
```

The app will run on `http://localhost:3001` (or next available port).

### Access the Authors Dashboard

1. Navigate to `http://localhost:3001`
2. Sign in with your Supabase auth credentials
3. Go to Dashboard → Authors
4. Click "Setup Demo Data" to populate sample content

## 📊 Step 3: Demo Data (Current Workaround)

Since RLS requires authentication, you have two options:

### Option A: Disable RLS Temporarily for Testing

In Supabase SQL Editor:

```sql
-- Temporarily disable RLS for testing
ALTER TABLE sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- Run demo setup via API
-- Then re-enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
```

### Option B: Manual Data Insert (Authenticated)

After signing in to your app, run in Supabase SQL Editor:

```sql
-- Replace 'your-user-id' with actual auth.uid() or user UUID
INSERT INTO sources (user_id, name, url, description, status) VALUES 
(
  'your-user-id',
  'Sam Altman''s Blog',
  'https://blog.samaltman.com/rss',
  '🌟 FEATURED AUTHOR: CEO of OpenAI, former YC President. Track his evolving views on AGI, AI safety, and the future of technology.',
  'active'
);
```

## 🎨 Step 4: Features to Test

Once data is loaded, test these Phase 1 features:

### 1. Author Dashboard
- **URL**: `/dashboard/authors`
- **Features**: Featured thought leaders, Phase 1 messaging, future features preview

### 2. Source Management
- **URL**: `/dashboard/connect`
- **Features**: Add/manage RSS sources with author relationships

### 3. Content Reading
- **URL**: `/dashboard`
- **Features**: Enhanced article reader with author attribution

## 🔧 Step 5: Next Development Steps

### Immediate (Technical)
1. **Schema Deployment**: Complete the database schema updates
2. **Authentication Flow**: Ensure proper user sign-up/sign-in
3. **Demo Data**: Load Sam Altman's actual blog content
4. **Author Profiles**: Complete the author profile system

### Phase 1 Launch Prep
1. **Sam Altman Setup**: Create full profile with historical content
2. **AI Analysis Pipeline**: Build contradiction detection
3. **Evolution Timeline**: Create position tracking views
4. **Beta User Testing**: Recruit 5-10 VCs for feedback

## 📈 Success Metrics for Phase 1

- **Technical**: All author features working with Sam Altman
- **Content**: 20+ Sam Altman articles with analysis
- **User Testing**: 5+ VCs actively using the system
- **Product-Market Fit**: Users asking for more authors

## 🚨 Current Blockers

1. **MCP Configuration**: Supabase MCP needs proper project reference
2. **RLS Authentication**: Demo setup requires authenticated users
3. **Schema Deployment**: Manual SQL execution needed

## 💡 Value Proposition Validation

The Phase 1 "Insider's Edge" positioning is proven by this foundation:

- ✅ **Single-Author Intelligence**: Technical architecture supports deep author tracking
- ✅ **Target Market Alignment**: VCs/researchers have clear use case for Sam Altman tracking  
- ✅ **Scalability**: System designed to expand to more thought leaders
- ✅ **Differentiation**: No other tool offers this level of author evolution analysis

## 🎯 Next Actions

1. **Deploy Schema**: Run `setup-db-manual.sql` in Supabase
2. **Test Authentication**: Ensure users can sign in
3. **Load Demo Data**: Either via API (authenticated) or SQL (manual)
4. **Test Features**: Verify author dashboard and source management
5. **Plan AI Pipeline**: Design contradiction detection system

This foundation perfectly supports your strategic vision for focused, high-value intelligence targeting the most influential voices in AI and technology. 