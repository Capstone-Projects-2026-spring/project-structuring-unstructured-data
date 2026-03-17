import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    "https://hiascmgwbykhwswbynqs.supabase.co" ,
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpYXNjbWd3YnlraHdzd2J5bnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzY1NzIsImV4cCI6MjA4OTM1MjU3Mn0.HFSIBiKryx9CaRwwt3FbRObHfK1kJ1i18g8zKZb56tE"
);

export default supabase;