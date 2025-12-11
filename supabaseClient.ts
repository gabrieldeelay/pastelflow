import { createClient } from '@supabase/supabase-js';

// Configuration based on provided credentials
const supabaseUrl = 'https://vemwpcgqwquszhrtjwtd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbXdwY2dxd3F1c3pocnRqd3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Nzk2ODksImV4cCI6MjA4MTA1NTY4OX0.PHLpcdufGIl2qcA8JVTjg0fSh-RWL3Z2hbVTlgGN8n4';

export const isSupabaseConfigured = () => {
    return true;
}

export const supabase = createClient(supabaseUrl, supabaseKey);