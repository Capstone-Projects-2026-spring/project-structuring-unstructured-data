import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://hiascmgwbykhwswbynqs.supabase.co" ,
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpYXNjbWd3YnlraHdzd2J5bnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzY1NzIsImV4cCI6MjA4OTM1MjU3Mn0.HFSIBiKryx9CaRwwt3FbRObHfK1kJ1i18g8zKZb56tE"
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