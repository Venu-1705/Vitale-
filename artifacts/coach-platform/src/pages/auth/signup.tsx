import { useState } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Leaf, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const signupSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type SignupForm = z.infer<typeof signupSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const signUp = useAuthStore((s) => s.signUp);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { businessName: '', email: '', password: '' },
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError(null);
    const result = await signUp(data.email, data.password, data.businessName);
    setIsLoading(false);
    if (result.ok && result.needsConfirmation) {
      toast.success('Check your email to confirm your account, then sign in — your organization is set up automatically.');
      setLocation('/login');
    } else if (result.ok) {
      toast.success('Welcome to Vitalé');
      setLocation('/admin/dashboard');
    } else {
      setError(result.error ?? 'Could not create your account');
    }
  };

  return (
    <div className="min-h-screen bg-sidebar flex flex-col justify-center items-center p-4 bg-gradient-to-br from-[#1A1A2E] to-primary/20">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-display text-2xl font-bold">Vitalé</span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-center mb-1">Create your coaching account</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Set up your organization to get started</p>

          {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="businessName" render={({ field }) => (
                <FormItem>
                  <Label>Business / practice name</Label>
                  <FormControl><Input placeholder="e.g. Vitalé Nutrition" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <Label>Email</Label>
                  <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <Label>Password</Label>
                  <FormControl><Input type="password" placeholder="Min 6 characters" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
              </Button>
            </form>
          </Form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <button className="text-primary font-semibold hover:underline" onClick={() => setLocation('/login')}>Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
