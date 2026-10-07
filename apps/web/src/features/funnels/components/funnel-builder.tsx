'use client';

import * as React from 'react';
import { Play, BookmarkPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calculateFunnelAction, saveFunnelAction } from '../actions';
import { FunnelChart } from './funnel-chart';
import type {
  FunnelQueryConfig, FunnelResult, FunnelStepConfig, FunnelWindowUnit,
} from '../types';

interface FunnelBuilderProps {
  projectId: string;
  projectSlug: string;
  initialQuery?: Partial<FunnelQueryConfig>;
}

const COMMON_EVENTS = [
  { value: '$pageview', label: '$pageview (automatic)' },
  { value: 'signup_started', label: 'signup_started (requires instrumentation)' },
  { value: 'signup_completed', label: 'signup_completed (requires instrumentation)' },
  { value: 'pricing_viewed', label: 'pricing_viewed (requires instrumentation)' },
  { value: 'checkout_started', label: 'checkout_started (requires instrumentation)' },
  { value: 'payment_submitted', label: 'payment_submitted (requires instrumentation)' },
];

const DEFAULT_STEPS: FunnelStepConfig[] = [
  { id: 'step-1', name: 'Page view', eventName: '$pageview' },
  { id: 'step-2', name: 'Next step', eventName: '' },
];

export function FunnelBuilder({ projectId, projectSlug, initialQuery }: FunnelBuilderProps) {
  const id = React.useId();
  const [steps, setSteps] = React.useState<FunnelStepConfig[]>(initialQuery?.steps || DEFAULT_STEPS);
  const [windowValue, setWindowValue] = React.useState(initialQuery?.conversionWindow?.value || 1);
  const [windowUnit, setWindowUnit] = React.useState<FunnelWindowUnit>(initialQuery?.conversionWindow?.unit || 'day');
  const [dateRange, setDateRange] = React.useState<FunnelQueryConfig['dateRange']>(initialQuery?.dateRange || '30d');
  const [loading, setLoading] = React.useState(false);
  const [funnelResult, setFunnelResult] = React.useState<FunnelResult | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [funnelName, setFunnelName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const canCalculate = steps.length >= 2 && steps.every((step) => step.eventName.trim());
  const currentConfig: FunnelQueryConfig = React.useMemo(() => ({
    steps,
    conversionWindow: { value: windowValue, unit: windowUnit },
    dateRange,
    ...(dateRange === 'custom' ? { customFrom: initialQuery?.customFrom, customTo: initialQuery?.customTo } : {}),
  }), [steps, windowValue, windowUnit, dateRange, initialQuery?.customFrom, initialQuery?.customTo]);

  const runCalculation = React.useCallback(async () => {
    if (!canCalculate) return;
    setLoading(true);
    try {
      const res = await calculateFunnelAction(projectId, currentConfig);
      if (res.success) setFunnelResult(res.data);
      else toast.error(res.error || 'Could not calculate the funnel');
    } catch (err: any) {
      toast.error(err?.message || 'Could not calculate the funnel');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentConfig, canCalculate]);

  // Only calculate automatically for a previously configured funnel, not an example flow.
  React.useEffect(() => {
    if (initialQuery?.steps?.length && canCalculate) void runCalculation();
  }, []);

  const addStep = () => {
    if (steps.length >= 8) return;
    setSteps([...steps, { id: `step-${Date.now()}`, name: `Step ${steps.length + 1}`, eventName: '' }]);
  };

  const updateStep = (index: number, updated: Partial<FunnelStepConfig>) => {
    setSteps(steps.map((step, i) => i === index ? { ...step, ...updated } : step));
  };

  const handleSaveFunnel = async () => {
    if (!funnelName.trim()) {
      toast.error('Enter a name for this funnel');
      return;
    }
    setSaving(true);
    try {
      const res = await saveFunnelAction(projectId, { name: funnelName.trim(), queryConfig: currentConfig });
      if (res.success) {
        toast.success(`Funnel "${res.funnel.name}" saved`);
        setIsSaveModalOpen(false);
        setFunnelName('');
      } else toast.error(res.error || 'Could not save the funnel');
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the funnel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-edge/60 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Funnels</h1>
          <p className="mt-1 text-sm text-muted">See where people drop off between captured events for {projectSlug}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsSaveModalOpen(true)} disabled={!canCalculate}>
            <BookmarkPlus aria-hidden="true" className="h-4 w-4" /> Save funnel
          </Button>
          <Button size="sm" onClick={runCalculation} disabled={loading || !canCalculate} aria-busy={loading}>
            <Play aria-hidden="true" className="h-4 w-4" /> {loading ? 'Calculating…' : 'Calculate funnel'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Configure steps</CardTitle>
          <CardDescription>Choose at least two events in order. Only $pageview is captured automatically; the other suggestions are examples that require instrumentation in your app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 rounded-lg border border-edge/60 bg-background/40 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="block text-sm font-medium">Conversion window</span>
              <div className="flex gap-2">
                <label htmlFor={`${id}-window-value`} className="sr-only">Conversion window length</label>
                <Input id={`${id}-window-value`} type="number" min="1" max="365" value={windowValue} onChange={(event) => setWindowValue(Math.max(1, parseInt(event.target.value, 10) || 1))} className="w-24 shrink-0" />
                <label htmlFor={`${id}-window-unit`} className="sr-only">Conversion window unit</label>
                <Select value={windowUnit} onValueChange={(value) => setWindowUnit(value as FunnelWindowUnit)}>
                  <SelectTrigger id={`${id}-window-unit`} className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minute">Minutes</SelectItem>
                    <SelectItem value="hour">Hours</SelectItem>
                    <SelectItem value="day">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-date-range`} className="text-sm font-medium">First-step date range</label>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as FunnelQueryConfig['dateRange'])}>
                <SelectTrigger id={`${id}-date-range`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dateRange === 'custom' && <SelectItem value="custom">Custom range (saved funnel)</SelectItem>}
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted md:col-span-2">People must complete the steps in order within {windowValue} {windowUnit}{windowValue === 1 ? '' : 's'} of the first step.</p>
          </div>

          <div className="space-y-3 border-t border-edge/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Ordered steps ({steps.length} of 8)</h2>
              <Button variant="outline" size="sm" onClick={addStep} disabled={steps.length >= 8}>
                <Plus aria-hidden="true" className="h-4 w-4" /> Add step
              </Button>
            </div>
            <p id={`${id}-step-hint`} className="text-sm text-muted">Enter the exact event name your app captures for every step. Suggested business events will not appear until you instrument them.</p>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id || index} role="group" aria-label={`Step ${index + 1}`} className="grid min-w-0 gap-3 rounded-lg border border-edge/60 bg-background/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-2">
                    <label htmlFor={`${id}-step-${index}-name`} className="text-sm font-medium">Step {index + 1} name</label>
                    <Input id={`${id}-step-${index}-name`} placeholder="Name this step" value={step.name || ''} onChange={(event) => updateStep(index, { name: event.target.value })} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label htmlFor={`${id}-step-${index}-event`} className="text-sm font-medium">Event name</label>
                    <Input id={`${id}-step-${index}-event`} placeholder="e.g. signup_completed" value={step.eventName} onChange={(event) => updateStep(index, { eventName: event.target.value.trim() })} className="font-mono" aria-describedby={`${id}-step-hint`} />
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps(steps.filter((_, i) => i !== index))} disabled={steps.length <= 2}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <label htmlFor={`${id}-step-${index}-suggestion`} className="text-sm text-muted">Choose an example or captured event</label>
                    <Select value={COMMON_EVENTS.some((event) => event.value === step.eventName) ? step.eventName : ''} onValueChange={(value) => updateStep(index, { eventName: value })}>
                      <SelectTrigger id={`${id}-step-${index}-suggestion`}><SelectValue placeholder={step.eventName ? 'Custom event name above' : 'Choose an event'} /></SelectTrigger>
                      <SelectContent>{COMMON_EVENTS.map((event) => <SelectItem key={event.value} value={event.value}>{event.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            {!canCalculate && <p className="text-sm text-muted">Add an event name to each step to calculate or save a funnel. Events must be captured before they can show results.</p>}
          </div>
        </CardContent>
      </Card>

      <FunnelChart data={funnelResult} loading={loading} projectSlug={projectSlug} />

      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save funnel</DialogTitle>
            <DialogDescription>Save these steps to track conversion from captured events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label htmlFor={`${id}-funnel-name`} className="text-sm font-medium">Funnel name</label>
            <Input id={`${id}-funnel-name`} placeholder="e.g. Signup funnel" value={funnelName} onChange={(event) => setFunnelName(event.target.value)} />
            <p className="break-words text-sm text-muted">Steps: {steps.map((step) => step.eventName).join(' → ')} · Window: {windowValue} {windowUnit}{windowValue === 1 ? '' : 's'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsSaveModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveFunnel} disabled={saving || !canCalculate}>{saving ? 'Saving…' : 'Save funnel'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
