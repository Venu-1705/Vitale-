import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import { Leaf, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, loginWithOtp } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [otpValue, setOtpValue] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError(null);

    const success = await login(data.email, data.password);

    if (success) {
      toast.success('Login successful');
      setLocation('/admin/dashboard');
    } else {
      setLoginError('Invalid email or password');
    }

    setIsLoading(false);
  };

  const onSendOtp = async () => {
    const email = form.getValues('email');
    if (!email || !z.string().email().safeParse(email).success) {
      form.trigger('email');
      return;
    }

    setIsLoading(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setIsLoading(false);
    if (error) { setLoginError(error.message); return; }
    setAuthMode('otp');
    toast.info('OTP sent to your email');
  };

  const onVerifyOtp = async (otp: string) => {
    if (otp.length !== 6) return;

    setIsLoading(true);
    const email = form.getValues('email');

    const success = await loginWithOtp(email, otp);
    
    if (success) {
      toast.success('Login successful');
      setLocation('/admin/dashboard');
    } else {
      setLoginError('Invalid OTP or user not found');
      setOtpValue('');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-sidebar flex flex-col justify-center items-center p-4 bg-gradient-to-br from-[#1A1A2E] to-primary/20">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8 sm:p-10">
          
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-2xl text-sidebar">Vitalé</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-2 text-sm">Sign in to your coach dashboard</p>
          </div>

          {loginError && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium text-center">
              {loginError}
            </div>
          )}

          <div className="relative overflow-hidden">
            {/* Password Login Flow */}
            <div className={`transition-all duration-300 transform ${authMode === 'password' ? 'translate-x-0 opacity-100 relative' : '-translate-x-full opacity-0 absolute inset-0'}`}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input placeholder="Email address" className="pl-10 h-12" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input 
                              type={showPassword ? 'text' : 'password'} 
                              placeholder="Password" 
                              className="pl-10 pr-10 h-12" 
                              {...field} 
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between text-sm">
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-muted-foreground font-medium cursor-pointer">
                              Remember me
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <Button variant="link" className="p-0 h-auto text-primary font-semibold" onClick={(e) => { e.preventDefault(); setLocation('/forgot-password'); }}>
                      Forgot password?
                    </Button>
                  </div>

                  <Button type="submit" className="w-full h-12 font-bold text-md" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-muted-foreground">OR</span>
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-12 font-semibold"
                    onClick={onSendOtp}
                    disabled={isLoading}
                  >
                    Sign in with OTP
                  </Button>
                </form>
              </Form>
            </div>

            {/* OTP Flow */}
            <div className={`transition-all duration-300 transform ${authMode === 'otp' ? 'translate-x-0 opacity-100 relative' : 'translate-x-full opacity-0 absolute inset-0'}`}>
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-sm text-foreground font-medium mb-4">
                    Enter the 6-digit code sent to <br/>
                    <span className="font-bold text-primary">{form.getValues('email')}</span>
                  </p>
                  
                  <div className="flex justify-center mb-6">
                    <InputOTP 
                      maxLength={6} 
                      value={otpValue}
                      onChange={setOtpValue}
                      onComplete={onVerifyOtp}
                      disabled={isLoading}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="w-12 h-14 text-lg font-bold" />
                        <InputOTPSlot index={1} className="w-12 h-14 text-lg font-bold" />
                        <InputOTPSlot index={2} className="w-12 h-14 text-lg font-bold" />
                        <InputOTPSlot index={3} className="w-12 h-14 text-lg font-bold" />
                        <InputOTPSlot index={4} className="w-12 h-14 text-lg font-bold" />
                        <InputOTPSlot index={5} className="w-12 h-14 text-lg font-bold" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  
                  {isLoading && (
                    <div className="flex justify-center text-primary mt-4">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  )}

                  <div className="mt-6 flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                      Didn't receive the code? <button className="text-primary font-bold hover:underline">Resend in 30s</button>
                    </p>
                    
                    <Button 
                      variant="ghost" 
                      className="text-muted-foreground mx-auto"
                      onClick={() => { setAuthMode('password'); setOtpValue(''); setLoginError(null); }}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to password login
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
        
        <div className="bg-muted/50 p-6 text-center border-t border-border">
          <p className="text-sm text-muted-foreground">
            Don't have an account? <span className="font-semibold text-foreground cursor-pointer hover:underline">Contact your admin</span>
          </p>
        </div>
      </div>

      {/* Demo Credentials Helper */}
      <div className="mt-8 text-white/60 text-xs text-center">
        <p className="font-semibold mb-1 text-white/80">Demo Credentials:</p>
        <p>admin@vitale.com / Admin@123</p>
        <p>coach@vitale.com / Coach@123</p>
      </div>
    </div>
  );
}
