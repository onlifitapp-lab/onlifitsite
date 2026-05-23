# ONLIFIT PROJECT CONTEXT

## Product
Onlifit is a mobile-first trainer marketplace platform where users can find personal trainers online or offline anytime.

Main users:
- Clients
- Trainers
- Admins

Main focus:
- Mobile-first UX
- Premium UI
- Fast trainer discovery
- Messaging
- Bookings
- Trainer dashboards
- Client dashboards

---

# CURRENT ARCHITECTURE

Frontend:
- Static HTML pages
- Tailwind CSS
- Shared JS helpers
- Inline scripts on some pages

Backend:
- Supabase
- Serverless API routes
- Razorpay integration

---

# CURRENT MAJOR PROBLEMS

- Mobile responsiveness instability
- Desktop regressions after mobile fixes
- Navbar overlap
- Inconsistent spacing
- Duplicate layout systems
- Large monolithic files
- Inline CSS conflicts
- Slow trainer loading
- Repeated components

---

# CURRENT REFACTOR PHASE

We are currently stabilizing the responsive architecture.

Goals:
1. Shared dashboard shell
2. Shared spacing/layout system
3. Stable navbar/header handling
4. Mobile-first responsiveness
5. Reusable components
6. Remove conflicting mobile overrides

---

# MOST IMPORTANT FILES

- bookings.html
- client-dashboard.html
- auth.js
- mobile-optimizations.css

---

# CURRENT PRIORITIES

Priority 1:
Responsive stabilization

Priority 2:
Reusable component system

Priority 3:
Performance optimization

Priority 4:
Messaging and settings cleanup

---

# IMPORTANT RULES

- Do not add random page-specific mobile fixes
- Preserve desktop stability
- Reuse shared layout classes
- Avoid inline CSS where possible
- Maintain consistent spacing system
- Mobile-first design