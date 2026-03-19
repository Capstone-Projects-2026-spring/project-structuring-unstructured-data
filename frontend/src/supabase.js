import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    "https://hiascmgwbykhwswbynqs.supabase.co" ,
    
);

export default supabase;