import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://hiascmgwbykhwswbynqs.supabase.co" ,
  
);

export const requestOTP = async (email) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: undefined, // 🚨 disables magic link behavior
    },
  });

  if (error) throw new Error(error.message);
};

export const verifyOTP = async (email, otp) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  });

  if (error) throw new Error(error.message);

  return {
    email: data.user.email,
    role: 'teacher',
  };
};