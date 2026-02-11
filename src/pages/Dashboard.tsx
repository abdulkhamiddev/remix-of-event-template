import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, Clock, ClipboardList, ListChecks } from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext';
import { TaskCard } from '@/components/tasks/TaskCard';
import { KPICard } from '@/components/tasks/KPICard';
import { Button } from '@/components/ui/button';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { getTodaysTasks } = useTaskContext();

  const todaysTasks = getTodaysTasks();
  const completedToday = todaysTasks.filter((t) => t.status === 'completed').length;
  const totalToday = todaysTasks.length;
  const remainingToday = todaysTasks.filter((t) => t.status !== 'completed').length;
  const productivity = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your task overview for today.
          </p>
        </div>
        <Button onClick={() => navigate('/tasks/create')} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Task
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Tasks (Today)"
          value={totalToday}
          subtitle="All scheduled today"
          icon={ClipboardList}
          variant="default"
        />
        <KPICard
          title="Tasks Remaining"
          value={remainingToday}
          subtitle="Still pending today"
          icon={Clock}
          variant={remainingToday === 0 ? 'success' : 'warning'}
        />
        <KPICard
          title="Completed Tasks"
          value={completedToday}
          subtitle="Done today"
          icon={CheckCircle}
          variant={completedToday > 0 ? 'success' : 'default'}
        />
        <KPICard
          title="Today's Productivity (%)"
          value={`${productivity}%`}
          subtitle="Completion rate"
          icon={ListChecks}
          variant={productivity >= 80 ? 'success' : productivity >= 50 ? 'warning' : 'default'}
        />
      </div>

      {/* Today's Task List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Today's Tasks</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
            View All
          </Button>
        </div>

        {todaysTasks.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No tasks for today
            </h3>
            <p className="text-muted-foreground mb-6">
              Create a new task to get started with your productivity journey.
            </p>
            <Button onClick={() => navigate('/tasks/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Task
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {todaysTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
