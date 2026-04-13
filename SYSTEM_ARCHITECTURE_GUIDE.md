# 🏋️ ONLIFIT - Complete System Architecture Guide

> **Last Updated:** April 2026  
> **Version:** 1.0  
> **Purpose:** Comprehensive documentation of the Onlifit platform architecture

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Database Schema](#database-schema)
5. [Authentication System](#authentication-system)
6. [File Structure](#file-structure)
7. [Page Connections](#page-connections)
8. [Features Breakdown](#features-breakdown)
9. [Storage System](#storage-system)
10. [External Services](#external-services)
11. [Styling System](#styling-system)
12. [Quick Reference](#quick-reference)

---

## 🎯 Overview

**Onlifit** is a modern fitness marketplace platform that connects personal trainers with clients. It's a full-stack web application built with:

- **Frontend:** HTML5 + Tailwind CSS + Vanilla JavaScript
- **Backend:** Supabase (PostgreSQL + Real-time + Auth + Storage)
- **Deployment:** Vercel (Static Hosting)
- **Domain:** onlifit.in

### Three User Roles

| Role | Description | Dashboard |
|------|-------------|-----------|
| **Client** | Fitness enthusiasts looking for trainers | client-dashboard.html |
| **Trainer** | Personal trainers offering services | bookings.html |
| **Admin** | Platform administrators | admin-dashboard.html |

---

## 🛠️ Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
├─────────────────────────────────────────────────────────────┤
│  • HTML5 (Pages)                                            │
│  • Tailwind CSS (Styling via CDN)                           │
│  • Vanilla JavaScript ES6+ (Logic)                          │
│  • Google Fonts (Poppins + Inter)                           │
│  • Material Symbols (Icons)                                 │
├─────────────────────────────────────────────────────────────┤
│                         BACKEND                             │
├─────────────────────────────────────────────────────────────┤
│  • Supabase PostgreSQL (Database)                           │
│  • Supabase Auth (Email + Google OAuth)                     │
│  • Supabase Storage (File uploads)                          │
│  • Supabase Realtime (WebSocket subscriptions)              │
├─────────────────────────────────────────────────────────────┤
│                      DEPLOYMENT                             │
├─────────────────────────────────────────────────────────────┤
│  • Vercel (Static Hosting)                                  │
│  • GitHub (Source Control)                                  │
│  • Custom Domain (onlifit.in)                               │
├─────────────────────────────────────────────────────────────┤
│                      LIBRARIES                              │
├─────────────────────────────────────────────────────────────┤
│  • Chart.js (Admin charts)                                  │
│  • jsPDF + autoTable (PDF exports)                          │
│  • Supabase JS Client (API)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                                   │
│                                                                       │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│   │   Client    │    │   Trainer   │    │    Admin    │              │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│          │                  │                  │                      │
│          └──────────────────┼──────────────────┘                      │
│                             │                                         │
│                    ┌────────▼────────┐                                │
│                    │  HTML + JS + CSS │                               │
│                    │  (Static Files)  │                               │
│                    └────────┬────────┘                                │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         VERCEL                                        │
│                    (onlifit.in)                                       │
│                                                                       │
│   • Static file hosting                                               │
│   • URL rewrite: / → /onlifit.html                                    │
│   • SSL/TLS certificates                                              │
│   • GitHub auto-deploy                                                │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │ API Calls + WebSocket
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                      │
│           (lnbsgnfrhewdqhuqqotx.supabase.co)                         │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    AUTHENTICATION                             │   │
│   │  • Email/Password signup & login                              │   │
│   │  • Google OAuth 2.0                                           │   │
│   │  • Session management (JWT)                                   │   │
│   │  • Role-based access (client/trainer/admin)                   │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    POSTGRESQL DATABASE                        │   │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐     │   │
│   │  │ profiles │ │ bookings │ │ messages │ │ notifications│     │   │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘     │   │
│   │  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐           │   │
│   │  │ reviews  │ │certifications│ │  typing_status  │           │   │
│   │  └──────────┘ └──────────────┘ └─────────────────┘           │   │
│   │                                                               │   │
│   │  + Row Level Security (RLS) Policies                          │   │
│   │  + Database Triggers & Functions                              │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    REALTIME                                   │   │
│   │  • WebSocket subscriptions for:                               │   │
│   │    - messages (chat)                                          │   │
│   │    - typing_status (typing indicators)                        │   │
│   │    - notifications (alerts)                                   │   │
│   │    - bookings (status updates)                                │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    STORAGE BUCKETS                            │   │
│   │  ┌────────────────┐  ┌──────────────────────┐                │   │
│   │  │    avatars     │  │ trainer_certifications │               │   │
│   │  │  (Public)      │  │      (Public)          │               │   │
│   │  └────────────────┘  └──────────────────────┘                │   │
│   │  ┌────────────────────┐                                       │   │
│   │  │ trainer-documents  │                                       │   │
│   │  │    (Private)       │                                       │   │
│   │  └────────────────────┘                                       │   │
│   └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               │ OAuth Callback
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD CONSOLE                               │
│                                                                       │
│   • OAuth 2.0 Client ID                                               │
│   • Authorized redirect URIs                                          │
│   • Google Sign-In button integration                                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Tables Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE TABLES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PROFILES                           BOOKINGS                                │
│   ─────────                          ─────────                               │
│   id (uuid, PK)                      id (uuid, PK)                           │
│   name                               client_id → profiles                    │
│   email                              trainer_id → profiles                   │
│   role (client/trainer/admin)        plan_type                               │
│   phone                              plan_label                              │
│   avatar_url                         price                                   │
│   specialty                          date                                    │
│   bio                                time                                    │
│   location                           status (confirmed/pending/cancelled)    │
│   rating                             created_at                              │
│   review_count                                                               │
│   experience                         MESSAGES                                │
│   plans (JSONB)                      ─────────                               │
│   certifications (array)             id (uuid, PK)                           │
│   tags (array)                       sender_id → profiles                    │
│   goal                               receiver_id → profiles                  │
│   age                                text                                    │
│   gender                             status (sent/delivered/seen)            │
│   verification_status                read (boolean)                          │
│   created_at                         created_at                              │
│   updated_at                                                                 │
│                                      NOTIFICATIONS                           │
│   REVIEWS                            ──────────────                          │
│   ───────                            id (uuid, PK)                           │
│   id (uuid, PK)                      user_id → profiles                      │
│   trainer_id → profiles              type (booking/message/alert)            │
│   client_id → profiles               title                                   │
│   rating (1-5)                       message                                 │
│   text                               read (boolean)                          │
│   created_at                         created_at                              │
│                                                                              │
│   CERTIFICATIONS                     TYPING_STATUS                           │
│   ──────────────                     ─────────────                           │
│   id (uuid, PK)                      user_id (PK)                            │
│   trainer_id → profiles              chat_with (PK)                          │
│   trainer_name                       is_typing (boolean)                     │
│   file_name                          updated_at                              │
│   file_url                                                                   │
│   file_type                                                                  │
│   file_size                                                                  │
│   uploaded_at                                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relationships

```
profiles (id)
    │
    ├──────────────────────────────────────────────────────────────┐
    │                                                              │
    ▼                                                              ▼
bookings.client_id                                    bookings.trainer_id
    │
    ├──────────────────────────────────────────────────────────────┐
    │                                                              │
    ▼                                                              ▼
messages.sender_id                                    messages.receiver_id
    │
    ▼
reviews.client_id ───────────────────────────────────► reviews.trainer_id
    │
    ▼
certifications.trainer_id
    │
    ▼
notifications.user_id
```

### Row Level Security (RLS) Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| **profiles** | Public | Own only | Own only | - |
| **bookings** | Involved parties | Client can create | - | - |
| **messages** | Sender/Receiver | Auth users | Own messages | - |
| **notifications** | Own only | System | Own (read status) | - |
| **reviews** | Public | Clients only | - | - |
| **certifications** | Public | Own (trainers) | - | Own |
| **typing_status** | Participants | Own | Own | Own |

---

## 🔐 Authentication System

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────┐
                    │      User Visits      │
                    │     onlifit.in        │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   New or Existing?    │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
    ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
    │   Sign Up     │   │    Login      │   │  Google Auth  │
    │  (New User)   │   │ (Existing)    │   │   (OAuth)     │
    └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────────────────────────────────────────────┐
    │                    SUPABASE AUTH                       │
    │                                                        │
    │   • Creates session (JWT token)                        │
    │   • Creates auth.users entry                           │
    │   • Triggers profile creation (database trigger)       │
    └───────────────────────────┬───────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Role Detection     │
                    │  (from profiles.role) │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
    ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
    │    CLIENT     │   │    TRAINER    │   │     ADMIN     │
    │               │   │               │   │               │
    │  Redirect to  │   │  Redirect to  │   │  Redirect to  │
    │  onboarding   │   │  trainer-     │   │  admin-       │
    │  or dashboard │   │  onboarding   │   │  dashboard    │
    └───────────────┘   └───────────────┘   └───────────────┘
```

### Auth Methods

#### 1. Email/Password

```javascript
// Sign Up
signUp(name, email, password, role, trainerData, phone)

// Login  
login(email, password)

// Logout
logout()
```

#### 2. Google OAuth

```javascript
// Google Sign In
signInWithGoogle(role, isSignup)

// Handle OAuth Callback (on page load)
handleOAuthCallback()
```

### Key Auth Functions (auth.js)

| Function | Purpose |
|----------|---------|
| `signUp()` | Register new user with email/password |
| `login()` | Authenticate existing user |
| `signInWithGoogle()` | Google OAuth authentication |
| `logout()` | End user session |
| `getCurrentUser()` | Get current authenticated user |
| `requireAuth()` | Protect pages (redirect if not auth) |
| `handleOAuthCallback()` | Process OAuth redirect |
| `updateUserProfile()` | Update profile data |
| `uploadAvatar()` | Upload profile picture |

---

## 📁 File Structure

```
Onlifit/
│
├── 📄 CORE FILES
│   ├── onlifit.html           # Main landing page (home)
│   ├── index.html             # Redirects to onlifit.html
│   ├── supabase-client.js     # Supabase initialization
│   ├── auth.js                # All auth & API functions
│   └── vercel.json            # Vercel deployment config
│
├── 🔐 AUTHENTICATION PAGES
│   ├── login.html             # Login & signup tabs
│   └── join-us.html           # Trainer signup page
│
├── 👤 CLIENT PAGES
│   ├── client-dashboard.html  # Client home dashboard
│   ├── onboarding.html        # Client onboarding flow
│   └── trainers.html          # Browse trainers directory
│
├── 🏋️ TRAINER PAGES
│   ├── trainer-onboarding.html # Trainer profile setup
│   ├── trainer-profile.html    # Individual trainer view
│   ├── trainer.html            # Legacy trainer page
│   └── bookings.html           # Trainer dashboard (bookings)
│
├── 💬 CORE FEATURES
│   ├── messages.html          # Chat/messaging system
│   ├── notifications.html     # Notification center
│   └── settings.html          # User settings & profile
│
├── 👑 ADMIN PAGES
│   ├── admin-dashboard.html   # Admin control panel
│   └── admin-login.html       # Admin login (deprecated)
│
├── 📄 STATIC PAGES
│   ├── about.html             # About us
│   ├── pricing.html           # Pricing plans
│   ├── faq.html               # FAQ
│   ├── privacy.html           # Privacy policy
│   └── terms.html             # Terms of service
│
├── 🔧 DEV/DEBUG PAGES
│   ├── debug-user.html        # Debug user profiles
│   ├── test-login-flow.html   # Test auth flow
│   ├── fix-trainer-account.html # Fix trainer accounts
│   └── create-dummy-trainers.html # Create test data
│
├── 📚 DOCUMENTATION
│   ├── SYSTEM_ARCHITECTURE_GUIDE.md # This file!
│   ├── GOOGLE_AUTH_SETUP.md   # Google OAuth setup
│   ├── SUPABASE_STORAGE_SETUP.md # Storage config
│   ├── ADMIN_PANEL_GUIDE.md   # Admin features
│   ├── CHAT_IMPLEMENTATION_SUMMARY.md # Chat system
│   └── ... (other docs)
│
├── 🗃️ SQL FILES
│   ├── supabase-schema.sql    # Complete DB schema
│   ├── COMPLETE_RLS_FIX.sql   # RLS policies
│   └── ... (other SQL files)
│
└── 🖼️ IMAGES
    ├── hero.png               # Hero section image
    ├── trainer-hero.jpg.jpg   # Trainer page hero
    ├── t1.webp - t4.webp      # Trainer photos
    └── become-trainer.jpg     # Join us page image
```

---

## 🔗 Page Connections

### Navigation Flow Diagram

```
                                    ┌──────────────┐
                                    │ onlifit.html │
                                    │  (Landing)   │
                                    └───────┬──────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
            ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
            │  login.html  │        │  join-us.html│        │ trainers.html│
            │ (Auth Portal)│        │(Trainer Join)│        │  (Browse)    │
            └───────┬──────┘        └───────┬──────┘        └───────┬──────┘
                    │                       │                       │
        ┌───────────┼───────────┐           │                       │
        │           │           │           │                       │
        ▼           ▼           ▼           ▼                       ▼
┌──────────────┐ ┌──────────┐ ┌─────────────────┐           ┌───────────────┐
│onboarding.   │ │bookings. │ │trainer-         │           │trainer-profile│
│html (Client) │ │html      │ │onboarding.html  │           │.html          │
└───────┬──────┘ │(Trainer) │ └────────┬────────┘           └───────────────┘
        │        └────┬─────┘          │
        ▼             │                │
┌──────────────┐      │                │
│client-       │      │                │
│dashboard.html│      │                │
└───────┬──────┘      │                │
        │             │                │
        └─────────────┼────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │         SHARED FEATURES             │
        │                                     │
        │  ┌──────────────┐ ┌──────────────┐  │
        │  │ messages.html│ │notifications │  │
        │  │   (Chat)     │ │    .html     │  │
        │  └──────────────┘ └──────────────┘  │
        │                                     │
        │  ┌──────────────┐                   │
        │  │settings.html │                   │
        │  │  (Profile)   │                   │
        │  └──────────────┘                   │
        └─────────────────────────────────────┘
```

### Page Access by Role

| Page | Client | Trainer | Admin |
|------|:------:|:-------:|:-----:|
| onlifit.html | ✅ | ✅ | ✅ |
| login.html | ✅ | ✅ | ✅ |
| join-us.html | - | ✅ | - |
| onboarding.html | ✅ | - | - |
| trainer-onboarding.html | - | ✅ | - |
| client-dashboard.html | ✅ | - | - |
| bookings.html | - | ✅ | - |
| trainers.html | ✅ | ✅ | ✅ |
| trainer-profile.html | ✅ | ✅ | ✅ |
| messages.html | ✅ | ✅ | - |
| notifications.html | ✅ | ✅ | - |
| settings.html | ✅ | ✅ | - |
| admin-dashboard.html | - | - | ✅ |

---

## ⚡ Features Breakdown

### 1. Chat/Messaging System

**Location:** `messages.html`  
**Real-time:** Supabase WebSocket subscriptions

```
┌─────────────────────────────────────────────────────────────┐
│                    MESSAGING SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Conversation List          │        Chat Window           │
│   ──────────────────         │        ───────────           │
│   ┌──────────────────┐       │   ┌───────────────────────┐  │
│   │ 👤 Trainer Name  │       │   │  Messages here...     │  │
│   │ Last message...  │       │   │  ────────────────     │  │
│   │ 🔵 Unread (3)    │       │   │  [User] Hello!        │  │
│   └──────────────────┘       │   │  [You] Hi there!      │  │
│   ┌──────────────────┐       │   │  [User] typing...     │  │
│   │ 👤 Another User  │       │   └───────────────────────┘  │
│   │ Thanks!          │       │   ┌───────────────────────┐  │
│   └──────────────────┘       │   │ [Type message...]  ➤  │  │
│                              │   └───────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Features:
✅ Real-time message delivery
✅ Typing indicators (animated dots)
✅ Read receipts (sent → delivered → seen)
✅ Unread message badges
✅ Conversation threading
✅ Last message preview
```

**Key Functions:**
- `sendMessage(senderId, receiverId, text)`
- `getMessages(user1, user2)`
- `markMessagesAsRead(senderId, receiverId)`
- `setTypingStatus(userId, chatWith, isTyping)`
- `subscribeToTable('messages', filter, callback)`

### 2. Booking System

**Location:** `trainer-profile.html` (book) → `bookings.html` (manage)

```
┌─────────────────────────────────────────────────────────────┐
│                     BOOKING FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. Client views trainer profile                            │
│                    │                                         │
│                    ▼                                         │
│   2. Selects pricing plan (Basic/Standard/Premium)           │
│                    │                                         │
│                    ▼                                         │
│   3. Chooses date and time                                   │
│                    │                                         │
│                    ▼                                         │
│   4. Confirms booking                                        │
│                    │                                         │
│                    ▼                                         │
│   5. Trainer receives notification                           │
│                    │                                         │
│                    ▼                                         │
│   6. Booking status: pending → confirmed/cancelled           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Plans Structure (JSONB in profiles.plans):**
```json
{
  "basic": { "price": 999, "label": "1 Session" },
  "standard": { "price": 3499, "label": "4 Sessions" },
  "premium": { "price": 5999, "label": "8 Sessions" },
  "elite": { "price": 9999, "label": "12 Sessions" }
}
```

### 3. Trainer Profile System

**Flow:** `join-us.html` → `trainer-onboarding.html` (5 steps)

```
┌─────────────────────────────────────────────────────────────┐
│              TRAINER ONBOARDING (5 STEPS)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Step 1: Basic Info                                         │
│   ───────────────────                                        │
│   Name, Email, Phone, Location                               │
│                                                              │
│   Step 2: Specialty                                          │
│   ─────────────────                                          │
│   Yoga, Weight Training, Cardio, Nutrition, etc.             │
│                                                              │
│   Step 3: Experience & Bio                                   │
│   ────────────────────────                                   │
│   Years of experience, detailed bio                          │
│                                                              │
│   Step 4: Pricing Plans                                      │
│   ────────────────────                                       │
│   Set prices for Basic, Standard, Premium, Elite             │
│                                                              │
│   Step 5: Certifications & KYC                               │
│   ────────────────────────────                               │
│   Upload ID (front/back) + certificates                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Admin Dashboard

**Location:** `admin-dashboard.html`  
**Access:** role = 'admin' only

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┬──────────┬──────────┬──────────┐             │
│   │Dashboard │ Trainers │ Revenue  │ Bookings │             │
│   └──────────┴──────────┴──────────┴──────────┘             │
│                                                              │
│   Dashboard Tab:                                             │
│   • Total trainers, clients, bookings                        │
│   • Revenue charts (Chart.js)                                │
│   • Recent activity                                          │
│                                                              │
│   Trainers Tab:                                              │
│   • List all trainers                                        │
│   • Verification status (pending/verified/rejected)          │
│   • View KYC documents modal                                 │
│   • Approve/Reject buttons                                   │
│                                                              │
│   Revenue Tab:                                               │
│   • Transaction history                                      │
│   • Filter by date range                                     │
│   • Export CSV/PDF                                           │
│                                                              │
│   Bookings Tab:                                              │
│   • All platform bookings                                    │
│   • Filter by status                                         │
│   • Search by trainer/client                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5. Notifications System

**Location:** `notifications.html`  
**Real-time:** Auto-updates via Supabase subscriptions

**Notification Types:**
- `booking` - New booking, status change
- `message` - New message received
- `alert` - System announcements

---

## 📦 Storage System

### Storage Buckets

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE STORAGE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   📁 avatars (PUBLIC)                                        │
│   └── {userId}/                                              │
│       └── profile.jpg                                        │
│                                                              │
│   📁 trainer_certifications (PUBLIC)                         │
│   └── {trainerId}/                                           │
│       ├── cert-1712345678.pdf                                │
│       └── cert-1712345789.jpg                                │
│                                                              │
│   📁 trainer-documents (PRIVATE)                             │
│   └── {trainerId}/                                           │
│       ├── kyc/                                               │
│       │   ├── id_front.jpg                                   │
│       │   └── id_back.jpg                                    │
│       └── certificates/                                      │
│           └── certificate1.pdf                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Upload Functions

```javascript
// Avatar upload
uploadAvatar(userId, file)
// Path: avatars/{userId}/{filename}

// Certification upload  
uploadCertification(trainerId, trainerName, file)
// Path: trainer_certifications/{trainerId}/cert-{timestamp}.{ext}

// Get public URL
getAvatarUrl(path)
```

---

## 🌐 External Services

### 1. Supabase

**URL:** `https://lnbsgnfrhewdqhuqqotx.supabase.co`

| Service | Purpose |
|---------|---------|
| Database | PostgreSQL with RLS |
| Auth | Email/Password + OAuth |
| Storage | 3 buckets for files |
| Realtime | WebSocket subscriptions |

### 2. Google Cloud Console

**Purpose:** OAuth 2.0 for Google Sign-In

**Configuration:**
- OAuth 2.0 Client ID
- Callback URL: `https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback`
- Authorized origins: `onlifit.in`

### 3. Vercel

**Purpose:** Static site hosting

**Configuration (vercel.json):**
```json
{
  "rewrites": [
    { "source": "/", "destination": "/onlifit.html" }
  ]
}
```

### 4. CDN Libraries

| Library | CDN URL | Purpose |
|---------|---------|---------|
| Supabase JS | cdn.jsdelivr.net/npm/@supabase/supabase-js@2 | API client |
| Tailwind CSS | cdn.tailwindcss.com | Styling |
| Chart.js | cdn.jsdelivr.net/npm/chart.js@4.4.0 | Admin charts |
| jsPDF | cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1 | PDF export |
| Google Fonts | fonts.googleapis.com | Poppins, Inter |
| Material Icons | fonts.googleapis.com/css2?family=Material+Symbols+Outlined | Icons |

---

## 🎨 Styling System

### Tailwind Custom Colors

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        "primary": "#000000",           // Black (buttons, accents)
        "primary-container": "#F5F5F5", // Light gray
        "secondary": "#1A1A1A",         // Dark gray
        "tertiary": "#333333",          // Medium gray
        "surface": "#FAFAFA",           // Near white
        "background": "#F5F5F5",        // Light background
        "on-surface": "#000000",        // Text on light bg
        "on-primary": "#FFFFFF",        // Text on dark bg
        "outline-variant": "#E8E8E8",   // Borders
      }
    }
  }
}
```

### Typography

| Type | Font | Weight | Usage |
|------|------|--------|-------|
| Headlines | Poppins | 600-900 | Titles, headers |
| Body | Inter | 400-600 | Regular text |

### Design Patterns

- **Glass Effect:** `backdrop-blur-[20px]` with semi-transparent bg
- **Cards:** Rounded corners (xl/2xl), soft shadows
- **Buttons:** Black bg, white text, hover states
- **Forms:** Light borders, focus rings
- **Mobile-first:** Responsive with Tailwind breakpoints

---

## 📖 Quick Reference

### Common Tasks

#### Add a new admin user:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

#### Fix profile not created:
```sql
-- Run the trigger fix from COMPLETE_RLS_FIX.sql
```

#### Debug auth issues:
1. Open `debug-user.html`
2. Enter user ID
3. Check profile data

### Important URLs

| Service | URL |
|---------|-----|
| Production Site | https://onlifit.in |
| Supabase Dashboard | https://supabase.com/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| Google Console | https://console.cloud.google.com |

### Key Files to Modify

| Task | File |
|------|------|
| Add new auth function | auth.js |
| Modify DB schema | supabase-schema.sql |
| Change styling | Tailwind classes in HTML |
| Update deployment | vercel.json |
| Add new page | Create HTML, add to nav |

### Database Quick Queries

```sql
-- Get all trainers
SELECT * FROM profiles WHERE role = 'trainer';

-- Get unverified trainers
SELECT * FROM profiles 
WHERE role = 'trainer' 
AND verification_status = 'pending';

-- Get recent bookings
SELECT * FROM bookings 
ORDER BY created_at DESC 
LIMIT 10;

-- Get unread messages for user
SELECT * FROM messages 
WHERE receiver_id = 'USER_ID' 
AND read = false;
```

---

## 🔄 Development Workflow

```
1. Make changes locally
        │
        ▼
2. Test on localhost (Live Server port 5501)
        │
        ▼
3. Commit changes to Git
        │
        ▼
4. Push to GitHub
        │
        ▼
5. Vercel auto-deploys
        │
        ▼
6. Live at onlifit.in
```

---

## 📞 Support & Documentation

### Related Documentation Files

| Document | Purpose |
|----------|---------|
| GOOGLE_AUTH_SETUP.md | Google OAuth configuration |
| SUPABASE_STORAGE_SETUP.md | Storage buckets & policies |
| ADMIN_PANEL_GUIDE.md | Admin features guide |
| CHAT_IMPLEMENTATION_SUMMARY.md | Chat system details |
| VERCEL_DEPLOYMENT.md | Deployment process |
| COMPLETE_RLS_FIX.sql | Database security fixes |

---

> **Note:** This document should be updated whenever major architectural changes are made to the system.

---

*Created for Onlifit Platform - Your Fitness Marketplace* 🏋️
