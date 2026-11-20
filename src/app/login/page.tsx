import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginPage() {
  const signIn = useAppStore((s) => s.signIn);
  const setRoute = useAppStore((s) => s.setRoute);
  const [email, setEmail] = React.useState('clara@northstarpress.io');
  const [password, setPassword] = React.useState('••••••••••••');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    signIn(email.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent mx-auto">
            <BookOpen className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Sign in to KDP Studio AI
          </h1>
          <p className="text-sm text-secondary">
            Access your manuscripts, niche research, and cover workflows.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs text-secondary">
              Work Email
            </label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs text-secondary">
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-secondary">
          New to KDP Studio AI?{' '}
          <button
            type="button"
            onClick={() => setRoute('/register')}
            className="text-accent font-medium hover:underline cursor-pointer"
          >
            Create an account
          </button>
        </p>
      </Card>
    </div>
  );
}
