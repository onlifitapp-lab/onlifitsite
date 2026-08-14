-- 1. Fix existing reviews table
ALTER TABLE reviews
    ALTER COLUMN trainer_id SET NOT NULL,
    ALTER COLUMN client_id SET NOT NULL,
    ALTER COLUMN rating SET NOT NULL;

-- 2. Add enquiry link (nullable — existing reviews have none, new ones will)
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS enquiry_id uuid REFERENCES client_enquiries(id) ON DELETE SET NULL;

-- 3. One review per client per trainer
ALTER TABLE reviews
    ADD CONSTRAINT reviews_unique_client_trainer UNIQUE (client_id, trainer_id);

-- 4. Trainer reply table
CREATE TABLE IF NOT EXISTS review_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    trainer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reply_text text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT review_replies_unique_review UNIQUE (review_id)
);

-- 5. RLS on review_replies
ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Replies viewable by everyone" ON review_replies FOR SELECT USING (true);
CREATE POLICY "Trainers can reply to their own reviews" ON review_replies FOR INSERT
    WITH CHECK (auth.uid() = trainer_id);
CREATE POLICY "Trainers can update their own reply" ON review_replies FOR UPDATE
    USING (auth.uid() = trainer_id);

-- 6. Add missing DELETE policy to reviews
CREATE POLICY "Clients can delete their own reviews" ON reviews FOR DELETE
    USING (auth.uid() = client_id);

-- 7. Trigger to keep profiles.rating and profiles.review_count in sync
CREATE OR REPLACE FUNCTION update_trainer_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET
        rating = COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 1)
            FROM reviews
            WHERE trainer_id = COALESCE(NEW.trainer_id, OLD.trainer_id)
        ), 0),
        review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE trainer_id = COALESCE(NEW.trainer_id, OLD.trainer_id)
        )
    WHERE id = COALESCE(NEW.trainer_id, OLD.trainer_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_update_trainer_rating
    AFTER INSERT OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_trainer_rating();
