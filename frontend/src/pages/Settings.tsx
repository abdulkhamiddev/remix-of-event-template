import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor, Palette, Calendar, Clock, Sidebar, Flame } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext.tsx';
import { AppSettings } from '@/types/task.ts';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Input } from '@/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { cn } from '@/lib/utils.ts';
import { apiFetch } from '@/lib/apiClient.ts';
import { toast } from '@/hooks/use-toast.ts';

interface SettingsApiResponse {
  minDailyTasks?: number;
  streakThresholdPercent?: number;
}

const Settings: React.FC = () => {
  const { settings, updateSettings, effectiveTheme } = useTheme();
  const [minDailyTasks, setMinDailyTasks] = useState<number>(3);
  const [thresholdPercent, setThresholdPercent] = useState<number>(80);
  const [isSavingStreak, setIsSavingStreak] = useState<boolean>(false);

  const themeOptions: { value: AppSettings['theme']; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  const themeProfiles: { value: AppSettings['themeProfile']; label: string; description: string }[] = [
    { value: 'focus', label: 'Focus', description: 'High contrast and low distraction.' },
    { value: 'calm', label: 'Calm', description: 'Softer surfaces with lower visual tension.' },
    { value: 'energy', label: 'Energy', description: 'Sharper accents for active planning.' },
  ];

  useEffect(() => {
    let active = true;

    const loadStreakSettings = async () => {
      try {
        const payload = await apiFetch<SettingsApiResponse>('/api/settings');
        if (!active) return;
        setMinDailyTasks(payload.minDailyTasks ?? 3);
        setThresholdPercent(payload.streakThresholdPercent ?? 80);
      } catch (_error) {
        if (!active) return;
        setMinDailyTasks(3);
        setThresholdPercent(80);
      }
    };

    loadStreakSettings();
    return () => {
      active = false;
    };
  }, []);

  const saveStreakSettings = async () => {
    const safeMin = Number.isFinite(minDailyTasks) ? Math.max(1, Math.floor(minDailyTasks)) : 3;
    const safeThreshold = Number.isFinite(thresholdPercent) ? Math.min(100, Math.max(1, Math.floor(thresholdPercent))) : 80;

    setIsSavingStreak(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          minDailyTasks: safeMin,
          streakThresholdPercent: safeThreshold,
        }),
      });
      setMinDailyTasks(safeMin);
      setThresholdPercent(safeThreshold);
      toast({ title: 'Streak settings saved' });
    } catch (_error) {
      toast({ title: 'Save failed', description: 'Could not update streak settings.', variant: 'destructive' });
    } finally {
      setIsSavingStreak(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Customize your TaskFlow experience
        </p>
      </div>

      {/* Theme */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        </div>

        <div className="space-y-4">
          <Label>Theme</Label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <Button
                key={option.value}
                variant={settings.theme === option.value ? 'default' : 'outline'}
                className="flex items-center justify-center gap-2 h-12"
                onClick={() => updateSettings({ theme: option.value })}
              >
                {option.icon}
                {option.label}
              </Button>
            ))}
          </div>
          {settings.theme === 'system' && (
            <p className="text-sm text-muted-foreground">
              Currently using: {effectiveTheme} theme
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label>Theme Profile</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {themeProfiles.map((profile) => (
              <button
                key={profile.value}
                type="button"
                onClick={() => updateSettings({ themeProfile: profile.value })}
                className={cn(
                  "rounded-xl border p-3 text-left transition-smooth",
                  settings.themeProfile === profile.value ? "border-primary/50 bg-primary/10" : "border-border/60 bg-card/70"
                )}
              >
                <p className="text-sm font-medium text-foreground">{profile.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{profile.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Reduced Animations</Label>
            <p className="text-sm text-muted-foreground">
              Minimize motion effects for accessibility
            </p>
          </div>
          <Switch
            checked={settings.animationIntensity === 'reduced'}
            onCheckedChange={(checked) =>
              updateSettings({ animationIntensity: checked ? 'reduced' : 'full' })
            }
          />
        </div>
      </div>

      {/* Layout */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sidebar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Layout</h2>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Sidebar Collapsed by Default</Label>
            <p className="text-sm text-muted-foreground">
              Start with a minimized sidebar on desktop
            </p>
          </div>
          <Switch
            checked={settings.sidebarCollapsed}
            onCheckedChange={(checked) =>
              updateSettings({ sidebarCollapsed: checked })
            }
          />
        </div>
      </div>

      {/* Date & Time */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Date & Time</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select
              value={settings.dateFormat}
              onValueChange={(v) => updateSettings({ dateFormat: v as AppSettings['dateFormat'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time Format</Label>
            <Select
              value={settings.timeFormat}
              onValueChange={(v) => updateSettings({ timeFormat: v as AppSettings['timeFormat'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Streak */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Flame className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Streak Rules</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minDailyTasks">MIN_DAILY_TASKS</Label>
            <Input
              id="minDailyTasks"
              type="number"
              min={1}
              value={minDailyTasks}
              onChange={(event) => setMinDailyTasks(Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thresholdPercent">THRESHOLD (%)</Label>
            <Input
              id="thresholdPercent"
              type="number"
              min={1}
              max={100}
              value={thresholdPercent}
              onChange={(event) => setThresholdPercent(Number(event.target.value || 0))}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          A day qualifies if scheduled tasks are at least MIN_DAILY_TASKS and completion ratio is at least THRESHOLD.
        </p>

        <div className="flex justify-end">
          <Button onClick={saveStreakSettings} disabled={isSavingStreak}>
            {isSavingStreak ? 'Saving...' : 'Save Streak Rules'}
          </Button>
        </div>
      </div>

      {/* About */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">About</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>TaskFlow</strong> v1.0</p>
          <p>A premium task management application with occurrence-based productivity analytics.</p>
          <p>Preferences sync with your account when you are signed in.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
