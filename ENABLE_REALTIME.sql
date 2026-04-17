-- EXERCISE: QUICK SETUP REAL-TIME
-- Copy and paste this script directly into your Supabase SQL Editor and click "Run"

-- Enable logical replication (Realtime WebSockets) for the profiles table
begin;
    -- Drop the table from publication if it already exists, to avoid duplicates
    alter publication supabase_realtime drop table profiles;
commit;

-- Now freshly add it back ensuring updates are broadcasted!
alter publication supabase_realtime add table profiles;

-- To verify if it worked, you can run: 
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
