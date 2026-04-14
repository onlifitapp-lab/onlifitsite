import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lnbsgnfrhewdqhuqqotx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYnNnbmZyaGV3ZHFodXFxb3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAyOTgxMywiZXhwIjoyMDkwNjA1ODEzfQ.x63Ov2IJxaNWcrA-CeHxkjfONyT635IQ9DFOUXOCj3w';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function makeAdmin() {
    const email = 'saranshandotra07@gmail.com';
    
    // First safely ensure their role is updated in the database
    console.log(`Checking profile for ${email}...`);
    
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

    if (error && error.code !== 'PGRST116') { // Ignore not found error
        console.error('Error fetching profile:', error);
        return;
    }

    if (!profile) {
        console.log(`Profile not found for ${email}. You must SIGN UP via the normal website first, before running this script.`);
        console.log("If you haven't created an account with that email, go to the site and Sign Up. Then re-run this script.");
        return;
    }

    console.log(`Found profile for ${email}. Current role: ${profile.role}`);

    const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', email)
        .select()
        .single();
        
    if (updateError) {
        console.error('Error updating role:', updateError);
        return;
    }
    
    console.log(`SUCCESS! ${email} has been updated to role: ${updated.role}`);
    console.log('You can now log in via admin-login.html');
}

makeAdmin();