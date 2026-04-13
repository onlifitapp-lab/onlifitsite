-- ================================================================
-- ONLIFIT ADMIN PANEL - PHASE 2 DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ================================================================

-- ============================================================
-- STEP 1: SUBSCRIPTION PLANS & PRICING
-- ============================================================

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    currency TEXT DEFAULT 'INR',
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    trial_days INTEGER DEFAULT 0,
    max_sessions INTEGER, -- null = unlimited
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT CHECK (status IN ('active', 'expired', 'cancelled', 'paused')) DEFAULT 'active',
    auto_renew BOOLEAN DEFAULT TRUE,
    payment_method TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT CHECK (discount_type IN ('percent', 'amount')) DEFAULT 'percent',
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    min_purchase DECIMAL(10,2),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create promo code usage tracking
CREATE TABLE IF NOT EXISTS promo_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    subscription_id UUID REFERENCES subscriptions(id),
    discount_applied DECIMAL(10,2),
    used_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- STEP 2: SUPPORT TICKETS SYSTEM
-- ============================================================

-- Create support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number SERIAL UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    category TEXT CHECK (category IN ('technical', 'billing', 'feature', 'bug', 'other')) DEFAULT 'other',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP
);

-- Create ticket messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- internal notes not visible to user
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- STEP 3: CLIENT ACTIVITY TRACKING
-- ============================================================

-- Extend profiles table for client management
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_status TEXT CHECK (account_status IN ('active', 'suspended', 'inactive')) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;

-- Create activity log table
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'login', 'booking', 'payment', 'profile_update', etc.
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- STEP 4: NOTIFICATIONS SYSTEM
-- ============================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('info', 'warning', 'success', 'promo', 'alert')) DEFAULT 'info',
    target_audience TEXT CHECK (target_audience IN ('all', 'clients', 'trainers', 'custom')) DEFAULT 'all',
    target_user_ids UUID[], -- for custom targeting
    action_url TEXT,
    action_label TEXT,
    sent_by UUID REFERENCES profiles(id),
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create user notifications read status
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(notification_id, user_id)
);

-- ============================================================
-- STEP 5: INDEXES FOR PERFORMANCE
-- ============================================================

-- Plans and subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code) WHERE is_active = TRUE;

-- Support tickets
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);

-- Activity and notifications
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id) WHERE is_read = FALSE;

-- Client management
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status) WHERE role = 'client';
CREATE INDEX IF NOT EXISTS idx_profiles_total_spent ON profiles(total_spent DESC) WHERE role = 'client';

-- ============================================================
-- STEP 6: ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Subscription plans - everyone can view active plans
CREATE POLICY "Anyone can view active plans"
ON subscription_plans FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Admins can manage plans
CREATE POLICY "Admins can manage plans"
ON subscription_plans FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Subscriptions - users can view their own
CREATE POLICY "Users can view own subscriptions"
ON subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON subscriptions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Admins can manage subscriptions
CREATE POLICY "Admins can manage subscriptions"
ON subscriptions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Promo codes - users can view active codes
CREATE POLICY "Users can view active promo codes"
ON promo_codes FOR SELECT
TO authenticated
USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- Admins can manage promo codes
CREATE POLICY "Admins can manage promo codes"
ON promo_codes FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Support tickets - users can view and create their own tickets
CREATE POLICY "Users can view own tickets"
ON support_tickets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
ON support_tickets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view and manage all tickets
CREATE POLICY "Admins can view all tickets"
ON support_tickets FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can manage tickets"
ON support_tickets FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Ticket messages - users can view messages on their tickets
CREATE POLICY "Users can view own ticket messages"
ON ticket_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM support_tickets
        WHERE support_tickets.id = ticket_messages.ticket_id
        AND support_tickets.user_id = auth.uid()
    )
    AND is_internal = FALSE -- users cannot see internal notes
);

CREATE POLICY "Users can reply to own tickets"
ON ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM support_tickets
        WHERE support_tickets.id = ticket_messages.ticket_id
        AND support_tickets.user_id = auth.uid()
    )
    AND sender_id = auth.uid()
);

-- Admins can view all ticket messages including internal notes
CREATE POLICY "Admins can view all ticket messages"
ON ticket_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can create ticket messages"
ON ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Activity log - users can view their own
CREATE POLICY "Users can view own activity"
ON user_activity_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all activity
CREATE POLICY "Admins can view all activity"
ON user_activity_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Notifications - users can view notifications sent to them
CREATE POLICY "Users can view their notifications"
ON user_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can mark notifications as read"
ON user_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all notifications
CREATE POLICY "Admins can manage notifications"
ON notifications FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- ============================================================
-- STEP 7: HELPER FUNCTIONS
-- ============================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get ticket response time
CREATE OR REPLACE FUNCTION get_avg_ticket_response_time()
RETURNS INTERVAL AS $$
BEGIN
    RETURN (
        SELECT AVG(tm.created_at - st.created_at)
        FROM support_tickets st
        JOIN ticket_messages tm ON tm.ticket_id = st.id
        WHERE tm.sender_id IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
        AND st.created_at > NOW() - INTERVAL '30 days'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if promo code is valid
CREATE OR REPLACE FUNCTION is_promo_code_valid(promo_code_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM promo_codes
        WHERE code = promo_code_text
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_uses IS NULL OR current_uses < max_uses)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 8: SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================================

-- Insert sample subscription plans
INSERT INTO subscription_plans (name, description, duration_months, price, features) VALUES
('Basic', 'Perfect for getting started with fitness', 1, 999.00, '["4 sessions per month", "Chat support", "Progress tracking"]'),
('Pro', 'For serious fitness enthusiasts', 3, 2499.00, '["12 sessions per 3 months", "Priority support", "Nutrition guidance", "Progress tracking", "Video consultations"]'),
('Elite', 'Premium experience with unlimited access', 6, 4499.00, '["Unlimited sessions", "24/7 support", "Personal nutrition plan", "Advanced analytics", "Video consultations", "Home workout plans"]')
ON CONFLICT DO NOTHING;

-- Insert sample promo code
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_uses) VALUES
('WELCOME50', 'Welcome discount for new users', 'percent', 50.00, 100)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUCCESS!
-- ============================================================

-- Your Phase 2 database is ready! ✅
-- 
-- Created tables:
-- ✅ subscription_plans - Pricing tiers
-- ✅ subscriptions - User subscriptions
-- ✅ promo_codes - Discount codes
-- ✅ promo_code_usage - Redemption tracking
-- ✅ support_tickets - Support system
-- ✅ ticket_messages - Ticket conversations
-- ✅ user_activity_log - Activity tracking
-- ✅ notifications - Broadcast system
-- ✅ user_notifications - Read status
--
-- Enhanced tables:
-- ✅ profiles - Added account_status, total_spent
--
-- Next steps:
-- 1. Update admin-dashboard.html with new tabs
-- 2. Implement Client Management interface
-- 3. Build Plans & Subscriptions CRUD
-- 4. Create Support Tickets system
-- 5. Add Analytics charts
