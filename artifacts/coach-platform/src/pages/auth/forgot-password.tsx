import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Leaf, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { supabase } from '@/lib/supabase';

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetForm) => {
    setIsLoading(true);
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/login`,
    });
    setIsLoading(false);
    // Always show success (don't reveal whether the email exists).
    setIsSuccess(true);
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

          {!isSuccess ? (
            <>
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl font-bold text-foreground">Reset Password</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                  <Button type="submit" className="w-full h-12 font-bold text-md" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Send Reset Link
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Check your email</h2>
              <p className="text-muted-foreground mb-6">
                We've sent a password reset link to <br/>
                <span className="font-medium text-foreground">{form.getValues('email')}</span>
              </p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Button 
              variant="ghost" 
              className="text-muted-foreground font-medium"
              onClick={() => setLocation('/login')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
            </Button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
