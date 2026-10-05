'use client';

import * as React from 'react';
import {
  Play,
  BookmarkPlus,
  Plus,
  Trash2,
  GitCommit,
  Clock,
  Layers,
  Sparkles,
  Filter as FilterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calculateFunnelAction, saveFunnelAction } from '../actions';
import { FunnelChart } from './funnel-chart';
import type {
  FunnelQueryConfig,
  FunnelResult,
  FunnelStepConfig,
  FunnelConversionWindow,
  FunnelWindowUnit,
} from '../types';

interface FunnelBuilderProps {
  projectId: string;
  projectSlug: string;
  initialQuery?: Partial<FunnelQueryConfig>;
}

const COMMON_EVENTS = [
  { value: '$pageview', label: '$pageview (Page View)' },
  { value: 'signup_started', label: 'signup_started' },
  { value: 'signup_completed', label: 'signup_completed' },
  { value: 'pricing_viewed', label: 'pricing_viewed' },
  { value: 'checkout_started', label: 'checkout_started' },
  { value: 'payment_submitted', label: 'payment_submitted' },
];

const DEFAULT_STEPS: FunnelStepConfig[] = [
  { id: 'step-1', name: 'Visited Website', eventName: '$pageview' },
  { id: 'step-2', name: 'Completed Signup', eventName: 'signup_completed' },
];

export function FunnelBuilder({
  projectId,
  projectSlug,
  initialQuery,
}: FunnelBuilderProps) {
  const [steps, setSteps] = React.useState<FunnelStepConfig[]>(
    initialQuery?.steps || DEFAULT_STEPS
  );
  const [windowValue, setWindowValue] = React.useState<number>(
    initialQuery?.conversionWindow?.value || 1
  );
  const [windowUnit, setWindowUnit] = React.useState<FunnelWindowUnit>(
    initialQuery?.conversionWindow?.unit || 'day'
  );
  const [dateRange, setDateRange] = React.useState<'7d' | '30d' | '90d' | 'custom'>(
    initialQuery?.dateRange || '30d'
  );

  const [loading, setLoading] = React.useState(false);
  const [funnelResult, setFunnelResult] = React.useState<FunnelResult | null>(null);

  // Save Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [funnelName, setFunnelName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const currentConfig: FunnelQueryConfig = React.useMemo(() => {
    return {
      steps,
      conversionWindow: {
        value: windowValue,
        unit: windowUnit,
      },
      dateRange,
    };
  }, [steps, windowValue, windowUnit, dateRange]);

  const runCalculation = React.useCallback(async () => {
    if (steps.length < 2) {
      toast.error('Funnels must have at least 2 steps');
      return;
    }
    setLoading(true);
    try {
      const res = await calculateFunnelAction(projectId, currentConfig);
      if (res.success) {
        setFunnelResult(res.data);
      } else {
        toast.error(res.error || 'Failed to calculate funnel');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error calculating funnel');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentConfig, steps.length]);

  // Initial calculation on mount
  React.useEffect(() => {
    runCalculation();
  }, []);

  const addStep = () => {
    if (steps.length >= 8) {
      toast.info('Funnels can contain up to 8 steps');
      return;
    }
    const newStepNum = steps.length + 1;
    setSteps([
      ...steps,
      {
        id: `step-${Date.now()}`,
        name: `Step ${newStepNum}`,
        eventName: 'checkout_started',
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 2) {
      toast.error('A funnel requires a minimum of 2 steps');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updated: Partial<FunnelStepConfig>) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...updated } : s)));
  };

  const handleSaveFunnel = async () => {
    if (!funnelName.trim()) {
      toast.error('Please enter a name for this funnel');
      return;
    }
    setSaving(true);
    try {
      const res = await saveFunnelAction(projectId, {
        name: funnelName.trim(),
        queryConfig: currentConfig,
      });

      if (res.success) {
        toast.success(`Funnel "${res.funnel.name}" saved!`);
        setIsSaveModalOpen(false);
        setFunnelName('');
      } else {
        toast.error(res.error || 'Failed to save funnel');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving funnel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Conversion Funnels
            </h1>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
              Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Multi-step funnel drop-offs, median conversion times, and user drilldowns for {projectSlug}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSaveModalOpen(true)}
            className="border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 text-xs h-8"
          >
            <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
            Save Funnel
          </Button>

          <Button
            size="sm"
            onClick={runCalculation}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-medium shadow-sm transition-all"
          >
            {loading ? (
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
            )}
            Calculate Funnel
          </Button>
        </div>
      </div>

      {/* Funnel Builder Configuration Panel */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Funnel Steps Configuration
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Define sequential user journey steps and maximum allowed conversion time window.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Conversion Window & Date Range Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-zinc-900/40 rounded border border-zinc-800/80">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                Conversion Window
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={windowValue}
                  onChange={(e) => setWindowValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-xs bg-zinc-950 border-zinc-800 w-20"
                />
                <select
                  value={windowUnit}
                  onChange={(e) => setWindowUnit(e.target.value as FunnelWindowUnit)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1 text-xs h-8 flex-1 focus:outline-none focus:border-emerald-500"
                >
                  <option value="minute">Minutes</option>
                  <option value="hour">Hours</option>
                  <option value="day">Days</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Date Range (Step 1 Entrance)</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1 text-xs h-8 focus:outline-none focus:border-emerald-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-[11px] text-zinc-500 bg-zinc-950/60 p-2 rounded border border-zinc-850 w-full">
                Users must complete all steps in sequence within {windowValue} {windowUnit}(s) of Step 1.
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-zinc-400" />
                Ordered Steps ({steps.length} / 8)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={addStep}
                disabled={steps.length >= 8}
                className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Step
              </Button>
            </div>

            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2.5 bg-zinc-900/60 rounded border border-zinc-800"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-zinc-800 text-xs font-mono font-semibold text-zinc-300">
                    {idx + 1}
                  </div>

                  <Input
                    type="text"
                    placeholder="Step Name (e.g. Pricing Page)"
                    value={step.name || ''}
                    onChange={(e) => updateStep(idx, { name: e.target.value })}
                    className="h-8 text-xs bg-zinc-950 border-zinc-800 w-full sm:w-56"
                  />

                  <div className="flex-1 w-full flex items-center gap-2">
                    <select
                      value={step.eventName}
                      onChange={(e) => updateStep(idx, { eventName: e.target.value })}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1 text-xs h-8 w-full sm:w-60 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      {COMMON_EVENTS.map((ev) => (
                        <option key={ev.value} value={ev.value}>
                          {ev.label}
                        </option>
                      ))}
                      {!COMMON_EVENTS.some((c) => c.value === step.eventName) && (
                        <option value={step.eventName}>{step.eventName}</option>
                      )}
                    </select>

                    <Input
                      type="text"
                      placeholder="Custom event name"
                      value={step.eventName}
                      onChange={(e) => updateStep(idx, { eventName: e.target.value.trim() })}
                      className="h-8 text-xs bg-zinc-950 border-zinc-800 flex-1 font-mono"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(idx)}
                    disabled={steps.length <= 2}
                    className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-400 self-end sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Funnel Result */}
      <FunnelChart
        data={funnelResult}
        loading={loading}
        projectSlug={projectSlug}
      />

      {/* Save Funnel Dialog */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Save Funnel</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Save this funnel configuration to monitor step conversion rates over time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Funnel Name</label>
              <Input
                type="text"
                placeholder="e.g. Onboarding Activation Funnel"
                value={funnelName}
                onChange={(e) => setFunnelName(e.target.value)}
                className="h-8 text-xs bg-zinc-900 border-zinc-800"
              />
            </div>
            <div className="text-[11px] text-zinc-500 space-y-1 bg-zinc-900/60 p-2.5 rounded border border-zinc-850">
              <div>
                <span className="text-zinc-400 font-medium">Steps: </span>
                {steps.map((s) => s.eventName).join(' → ')}
              </div>
              <div>
                <span className="text-zinc-400 font-medium">Window: </span>
                {windowValue} {windowUnit}(s)
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveModalOpen(false)}
              className="border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveFunnel}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              {saving ? 'Saving...' : 'Save Funnel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
