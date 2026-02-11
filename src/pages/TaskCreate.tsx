import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Timer, Calendar, Clock, Repeat, Tag, Plus, Trash2, Edit2 } from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext';
import { Priority, RecurringPattern } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format, addMinutes, isToday, parseISO, isBefore, startOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TaskCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addTask, categories, addCategory, updateCategory, deleteCategory } = useTaskContext();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const dateParam = searchParams.get('date');
  const calendarState = location.state as { selectedDate?: string; fromCalendar?: boolean } | null;
  const fromCalendar = searchParams.get('source') === 'calendar' || calendarState?.fromCalendar;
  const lockedDate = useMemo(() => {
    const raw = dateParam || calendarState?.selectedDate;
    if (!raw) return null;
    const parsed = parseISO(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [dateParam, calendarState?.selectedDate]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [scheduledDate, setScheduledDate] = useState<Date>(lockedDate ?? new Date());
  const [category, setCategory] = useState('Study');

  // Optional toggles
  const [hasTimer, setHasTimer] = useState(false);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(30);

  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState('');

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);

  // Category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const isLockedDate = Boolean(fromCalendar && lockedDate);
  const todayStart = startOfDay(new Date());
  const scheduledDateIsPast = isBefore(startOfDay(scheduledDate), todayStart);

  useEffect(() => {
    if (lockedDate) {
      setScheduledDate(lockedDate);
    }
  }, [lockedDate]);

  // Calculate minimum deadline time
  const minDeadlineTime = useMemo(() => {
    if (!isToday(scheduledDate)) return '00:00';
    const minTime = addMinutes(new Date(), 30);
    return format(minTime, 'HH:mm');
  }, [scheduledDate]);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    addCategory(newCategoryName.trim());
    setCategory(newCategoryName.trim());
    setNewCategoryName('');
    toast({ title: 'Category created', description: `"${newCategoryName}" has been added.` });
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    updateCategory(editingCategory.id, editingCategory.name.trim());
    setEditingCategory(null);
    toast({ title: 'Category updated' });
  };

  const handleDeleteCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    
    if (cat.isDefault) {
      toast({ title: 'Cannot delete', description: 'Default categories cannot be removed.', variant: 'destructive' });
      return;
    }

    const success = deleteCategory(id);
    if (success) {
      toast({ title: 'Category deleted' });
      if (category === cat.name) {
        setCategory('Study');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a task title.', variant: 'destructive' });
      return;
    }

    const finalDate = isLockedDate && lockedDate ? lockedDate : scheduledDate;
    if (isBefore(startOfDay(finalDate), todayStart)) {
      toast({ title: 'Invalid date', description: 'Tasks cannot be created for past dates.', variant: 'destructive' });
      return;
    }

    const timerDuration = hasTimer ? (timerHours * 3600) + (timerMinutes * 60) : 0;

    addTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      scheduledDate: format(finalDate, 'yyyy-MM-dd'),
      category,
      hasTimer,
      timerDuration,
      timerRemaining: timerDuration,
      hasDeadline,
      deadlineTime: hasDeadline ? deadlineTime : '',
      isRecurring,
      recurringPattern: isRecurring ? recurringPattern : null,
      customDays: isRecurring && recurringPattern === 'custom' ? customDays : [],
    });

    toast({ title: 'Task created', description: `"${title}" has been added to your tasks.` });
    navigate('/tasks');
  };

  const toggleCustomDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Task</h1>
          <p className="text-muted-foreground">Add a new task to your list</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Base Fields */}
        <div className="glass-card rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-priority-low" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-priority-medium" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-priority-high" />
                      High
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              {isLockedDate && lockedDate ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    Scheduled for: {format(lockedDate, 'yyyy-MM-dd')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Date locked from Calendar</span>
                </div>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(scheduledDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={scheduledDate}
                      onSelect={(d) => d && setScheduledDate(d)}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Category</h2>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Categories</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        {editingCategory?.id === cat.id ? (
                          <div className="flex gap-2 flex-1">
                            <Input
                              value={editingCategory.name}
                              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                              className="h-8"
                            />
                            <Button size="sm" onClick={handleUpdateCategory}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{cat.name}</span>
                            <div className="flex items-center gap-1">
                              {cat.isDefault && <Badge variant="secondary">Default</Badge>}
                              {!cat.isDefault && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => setEditingCategory({ id: cat.id, name: cat.name })}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timer */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Timer</h2>
            </div>
            <Switch checked={hasTimer} onCheckedChange={setHasTimer} />
          </div>

          {hasTimer && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={timerHours}
                    onChange={(e) => setTimerHours(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                Start the task to begin the timer. You cannot mark it as completed until the time runs out.
              </p>
            </>
          )}
        </div>

        {/* Recurring */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Recurring Task</h2>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="space-y-4">
              <Select value={recurringPattern} onValueChange={(v) => setRecurringPattern(v as RecurringPattern)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Which days / Custom</SelectItem>
                </SelectContent>
              </Select>

              {recurringPattern === 'custom' && (
                <div className="space-y-2">
                  <Label>Select Days</Label>
                  <div className="flex gap-2">
                    {WEEKDAYS.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleCustomDay(index)}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-sm font-medium transition-smooth',
                          customDays.includes(index)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deadline */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Deadline</h2>
            </div>
            <Switch checked={hasDeadline} onCheckedChange={setHasDeadline} />
          </div>

          {hasDeadline && (
            <div className="space-y-2">
              <Label>Deadline Time</Label>
              <Input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                min={minDeadlineTime}
              />
              {isToday(scheduledDate) && (
                <p className="text-xs text-muted-foreground">
                  Minimum time for today: {minDeadlineTime}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={scheduledDateIsPast}>
            <Save className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TaskCreate;
