import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, LayoutGrid, Filter, Search, ArrowUpDown } from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext.tsx';
import { TaskCard } from '@/components/tasks/TaskCard.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { useIsMobile } from '@/hooks/use-mobile.tsx';
import { parseISO } from 'date-fns';

type ViewMode = 'list' | 'kanban';
type FilterStatus = 'all' | 'pending' | 'completed' | 'overdue';
type YesNoFilter = 'all' | 'yes' | 'no';
type SortOption = 'date' | 'priority' | 'deadline';

const priorityOrder: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { tasks, categories } = useTaskContext();

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [timerFilter, setTimerFilter] = useState<YesNoFilter>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<YesNoFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date');

  useEffect(() => {
    setViewMode(isMobile ? 'list' : 'kanban');
  }, [isMobile]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (search) {
        const query = search.toLowerCase();
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && task.category !== categoryFilter) {
        return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      if (timerFilter !== 'all' && task.hasTimer !== (timerFilter === 'yes')) {
        return false;
      }
      if (deadlineFilter !== 'all' && task.hasDeadline !== (deadlineFilter === 'yes')) {
        return false;
      }
      return true;
    });
  }, [
    tasks,
    search,
    statusFilter,
    categoryFilter,
    priorityFilter,
    timerFilter,
    deadlineFilter,
  ]);

  const sortedTasks = useMemo(() => {
    const list = [...filteredTasks];

    list.sort((a, b) => {
      if (sortBy === 'priority') {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      if (sortBy === 'deadline') {
        const aHasDeadline = a.hasDeadline && a.deadlineTime;
        const bHasDeadline = b.hasDeadline && b.deadlineTime;

        if (!aHasDeadline && !bHasDeadline) return 0;
        if (!aHasDeadline) return 1;
        if (!bHasDeadline) return -1;

        const aDeadline = new Date(`${a.scheduledDate}T${a.deadlineTime}`);
        const bDeadline = new Date(`${b.scheduledDate}T${b.deadlineTime}`);
        return aDeadline.getTime() - bDeadline.getTime();
      }

      const aDate = parseISO(a.scheduledDate).getTime();
      const bDate = parseISO(b.scheduledDate).getTime();
      return aDate - bDate;
    });

    return list;
  }, [filteredTasks, sortBy]);

  const pendingTasks = sortedTasks.filter((t) => t.status === 'pending');
  const completedTasks = sortedTasks.filter((t) => t.status === 'completed');
  const overdueTasks = sortedTasks.filter((t) => t.status === 'overdue');

  const activeFilters = [
    statusFilter,
    categoryFilter,
    priorityFilter,
    timerFilter,
    deadlineFilter,
  ].filter((f) => f !== 'all').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage all your tasks in one place</p>
        </div>
        <Button onClick={() => navigate('/tasks/create')} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {activeFilters > 0 && <Badge variant="secondary">{activeFilters} active</Badge>}
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timerFilter} onValueChange={(v) => setTimerFilter(v as YesNoFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Has Timer</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>

          <Select value={deadlineFilter} onValueChange={(v) => setDeadlineFilter(v as YesNoFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Deadline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Has Deadline</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>

          {activeFilters > 0 || search ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setPriorityFilter('all');
                setTimerFilter('all');
                setDeadlineFilter('all');
                setSearch('');
              }}
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      {/* Task content */}
      {sortedTasks.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">
            {tasks.length === 0
              ? 'No tasks yet. Create your first task to get started!'
              : 'No tasks match your filters.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {sortedTasks.map((task) => (
            <TaskCard key={task.id} task={task} showDate />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pending Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Pending</h3>
              <Badge variant="secondary">{pendingTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <TaskCard key={task.id} task={task} showDate />
              ))}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Completed</h3>
              <Badge variant="secondary">{completedTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} showDate />
              ))}
            </div>
          </div>

          {/* Overdue Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-destructive">Overdue</h3>
              <Badge variant="destructive">{overdueTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <TaskCard key={task.id} task={task} showDate />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
