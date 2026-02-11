import React from 'react';
import { Moon, Sun, Monitor, Palette, Calendar, Clock, Sidebar } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext.tsx';
import { AppSettings } from '@/types/task.ts';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { cn } from '@/lib/utils.ts';

const Settings: React.FC = () => {
  const { settings, updateSettings, effectiveTheme } = useTheme();

  const themeOptions: { value: AppSettings['theme']; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

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

      {/* About */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">About</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>TaskFlow</strong> v1.0</p>
          <p>A premium task management application with liquid glass UI.</p>
          <p>All data is stored locally in your browser.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
