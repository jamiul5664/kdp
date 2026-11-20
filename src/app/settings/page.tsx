import * as React from 'react';
import { Check, Cpu, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { AiProvidersManager } from '../../components/settings/AiProvidersManager';

type SettingsTab = 'providers' | 'general';

export default function SettingsPage() {
  const user = useAppStore((s) => s.user);
  const updateUserProfile = useAppStore((s) => s.updateUserProfile);
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = React.useState<SettingsTab>('providers');
  const [name, setName] = React.useState(user.name);
  const [imprint, setImprint] = React.useState(user.imprint);
  const [role, setRole] = React.useState(user.role);
  const [defaultMarketplace, setDefaultMarketplace] = React.useState('amazon.com');
  const [savedNotice, setSavedNotice] = React.useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: name.trim() || user.name,
      imprint: imprint.trim(),
      role: role.trim(),
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Workspace Settings
          </h1>
          <p className="text-sm text-secondary">
            Manage AI providers, unlimited API keys, task routing, and publisher workspace defaults.
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg border border-border-subtle bg-sidebar p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'providers'
                ? 'bg-accent text-white'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            AI Providers &amp; API Manager
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'bg-accent text-white'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            General Settings
          </button>
        </div>
      </div>

      {activeTab === 'providers' ? (
        <AiProvidersManager />
      ) : (
        <div className="max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Theme</CardTitle>
              <CardDescription>
                Switch between the KDP Studio AI dark workspace and light editorial mode
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'border-accent bg-accent/10'
                    : 'border-border-subtle bg-sidebar hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Moon className="h-4 w-4 text-accent" />
                  {theme === 'dark' && <Check className="h-4 w-4 text-accent" />}
                </div>
                <p className="font-display text-sm font-semibold text-foreground mt-3">Dark SaaS</p>
                <p className="text-xs text-secondary mt-0.5">#0B0D12 canvas · #171B25 cards</p>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'border-accent bg-accent/10'
                    : 'border-border-subtle bg-sidebar hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sun className="h-4 w-4 text-accent" />
                  {theme === 'light' && <Check className="h-4 w-4 text-accent" />}
                </div>
                <p className="font-display text-sm font-semibold text-foreground mt-3">
                  Light Editorial
                </p>
                <p className="text-xs text-secondary mt-0.5">Clean daylight contrast workspace</p>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publisher Profile &amp; Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-secondary">Display Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-secondary">Publishing Imprint</label>
                    <Input value={imprint} onChange={(e) => setImprint(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-secondary">Role</label>
                    <Input value={role} onChange={(e) => setRole(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-secondary">Default Marketplace</label>
                    <Select
                      value={defaultMarketplace}
                      onChange={(e) => setDefaultMarketplace(e.target.value)}
                    >
                      <option value="amazon.com">Amazon US (amazon.com)</option>
                      <option value="amazon.co.uk">Amazon UK (amazon.co.uk)</option>
                      <option value="amazon.de">Amazon DE (amazon.de)</option>
                      <option value="amazon.ca">Amazon CA (amazon.ca)</option>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-teal">
                    {savedNotice ? 'Profile preferences saved.' : ''}
                  </span>
                  <Button type="submit">Save Preferences</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
