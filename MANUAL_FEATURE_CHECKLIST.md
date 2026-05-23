# Onlifit Manual Feature Checklist

Use this list to verify the app end to end before adding new features.

## Public Site
- [ ] Homepage loads without broken assets.
- [ ] Trainer cards load on the homepage.
- [ ] Navigation links work from homepage to About, Pricing, Blog, Free Tools, Join Us, Login, Support.
- [ ] Trainer profile pages open from trainer cards.
- [ ] Search, filters, and trainer discovery work on the trainers page.
- [ ] Blog pages load correctly.
- [ ] Calculators page loads and tools work.
- [ ] Footer links work on all public pages.

## Authentication
- [ ] Email sign-in works.
- [ ] Email sign-up works.
- [ ] Google sign-in works.
- [ ] Trainer signup routes to trainer onboarding.
- [ ] Client signup routes to client onboarding.
- [ ] Logout clears the session.
- [ ] Login redirects to the correct dashboard by role.

## Trainer Dashboard
- [ ] Trainer dashboard loads after login.
- [ ] Sidebar navigation works on desktop.
- [ ] Mobile burger menu opens and closes the trainer sidebar.
- [ ] Dashboard summary stats load correctly.
- [ ] Bookings list loads correctly.
- [ ] Session status updates work.
- [ ] Messages section opens from the dashboard.
- [ ] Trainer can open a client chat.
- [ ] Trainer can send a message.
- [ ] Realtime message updates appear without refresh.
- [ ] Unread count updates correctly.
- [ ] Read/seen state updates correctly.
- [ ] Lead limit popup appears for Free plan trainers.
- [ ] Upgrade button opens pricing.
- [ ] Later button closes the popup.
- [ ] Settings updates work.
- [ ] Password update works if enabled.
- [ ] Dashboard is usable on mobile.

## Client Dashboard
- [ ] Client dashboard loads after login.
- [ ] Sidebar navigation works on desktop.
- [ ] Mobile burger menu opens and closes the client sidebar.
- [ ] Dashboard cards load correctly.
- [ ] Bookings list loads correctly.
- [ ] Find trainers page opens from the dashboard.
- [ ] Saved trainers page works.
- [ ] Client can open trainer chat.
- [ ] Client can send a message.
- [ ] Realtime message updates appear without refresh.
- [ ] Chat history persists after refresh.
- [ ] Password update works if enabled.
- [ ] Dashboard is usable on mobile.

## Messaging
- [ ] Trainer messages appear in the client dashboard.
- [ ] Client messages appear in the trainer dashboard.
- [ ] New message notifications are created.
- [ ] Typing indicator works.
- [ ] Conversation deep links open the correct chat.
- [ ] Mark as read works when opening a conversation.
- [ ] Unread counter matches the actual unread messages.

## Bookings and Payments
- [ ] Booking creation works.
- [ ] Booking confirmation is saved.
- [ ] Booking cancellation works.
- [ ] Payment flow creates an order correctly.
- [ ] Payment verification succeeds.
- [ ] Commission is calculated server-side.
- [ ] Trainer earnings / revenue views show real data.

## Admin
- [ ] Admin login works.
- [ ] Admin dashboard opens for admin users only.
- [ ] Trainer verification list loads.
- [ ] Trainer documents load.
- [ ] Admin approve/reject actions work.
- [ ] Admin delete trainer action works.
- [ ] Revenue and bookings views load.
- [ ] Support and analytics sections load.

## Notifications and Support
- [ ] Notifications page loads.
- [ ] Booking notifications appear.
- [ ] Message notifications appear.
- [ ] Support ticket creation works.
- [ ] Support ticket replies work.
- [ ] Notification read state updates.

## Mobile and Layout
- [ ] Pages do not overflow horizontally on mobile.
- [ ] Buttons have a usable touch target.
- [ ] Forms are readable without zooming.
- [ ] Modals fit within the viewport.
- [ ] Sidebars collapse into drawers on mobile.
- [ ] Tables and long lists scroll cleanly on small screens.

## Data and Realtime
- [ ] Supabase connection is active.
- [ ] Messages table is published to realtime.
- [ ] Bookings table is published to realtime.
- [ ] Notifications table is published to realtime.
- [ ] Typing status table is published to realtime.
- [ ] RLS policies allow the intended user actions.

## Add Next
- [ ] Add the next feature request here after the current checklist is done.
