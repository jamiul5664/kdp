import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function RegisterPage() {
  const signIn = useAppStore((s) => s.signIn);
  const setRoute = useAppStore((s) => s.setRoute);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    signIn(email.trim(), name.trim() || 'Independent Publisher');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent mx-auto">
            <BookOpen className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Create Your Studio Account
          </h1>
          <p className="text-sm text-secondary">
            Start researching niches, designing KDP covers, and preparing print-ready books.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="text-xs text-secondary">
              Full Name
            </label>
            <Input
              id="reg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clara Vance"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-xs text-secondary">
              Work Email
            </label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@imprint.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="text-xs text-secondary">
              Password
            </label>
            <Input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a secure password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Create Workspace
          </Button>
        </form>

        <p className="text-center text-xs text-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => setRoute('/login')}
            className="text-accent font-medium hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </p>
      </Card>
    </div>
  );
}
