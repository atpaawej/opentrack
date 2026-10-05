'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Check,
  Copy,
  RotateCw,
  Eye,
  EyeOff,
  Trash2,
  Download,
  AlertTriangle,
  Key,
  Shield,
  Clock,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  updateProjectDomainsAction,
  rotateApiKeyAction,
  updateProjectPrivacyAction,
  gdprPurgeUserAction,
  exportUserEventsAction,
} from '@/features/projects/actions';
import { toast } from 'sonner';
import type { Project } from '@/lib/db/schema';

interface SettingsFormProps {
  project: Project;
}

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC — Coordinated Universal Time' },
  { value: 'America/New_York', label: 'America/New_York — Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago — Central Time (CT)' },
  { value: 'America/Denver', label: 'America/Denver — Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles — Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Europe/London — Greenwich Mean / British Summer Time' },
  { value: 'Europe/Paris', label: 'Europe/Paris — Central European Time' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin — Central European Time' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai — Gulf Standard Time' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata — India Standard Time' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore — Singapore Time' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo — Japan Standard Time' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney — Australian Eastern Time' },
];

const RETENTION_OPTIONS = [
  { value: 90, label: '90 days (3 months)' },
  { value: 180, label: '180 days (6 months)' },
  { value: 365, label: '365 days (1 year)' },
  { value: 0, label: 'Unlimited (Retain indefinitely)' },
];

export function SettingsForm({ project: initialProject }: SettingsFormProps) {
  const [project, setProject] = React.useState<Project>(initialProject);

  // API Keys state
  const [copiedPublishable, setCopiedPublishable] = React.useState(false);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const [showSecretKey, setShowSecretKey] = React.useState(false);
  const [rotateKeyType, setRotateKeyType] = React.useState<'public' | 'secret' | null>(null);
  const [isRotating, setIsRotating] = React.useState(false);

  // Allowed domains state
  const [domains, setDomains] = React.useState(
    project.allowedDomains ? project.allowedDomains.join(', ') : ''
  );
  const [isSavingDomains, setIsSavingDomains] = React.useState(false);

  // Privacy & retention state
  const [dataRetentionDays, setDataRetentionDays] = React.useState<number>(
    project.dataRetentionDays ?? 365
  );
  const [timezone, setTimezone] = React.useState<string>(project.timezone || 'UTC');
  const [isSavingPrivacy, setIsSavingPrivacy] = React.useState(false);

  // GDPR state
  const [purgeDistinctId, setPurgeDistinctId] = React.useState('');
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = React.useState(false);
  const [isPurging, setIsPurging] = React.useState(false);

  // Export state
  const [exportDistinctId, setExportDistinctId] = React.useState('');
  const [isExporting, setIsExporting] = React.useState(false);

  // --- Handlers ---

  const handleCopyPublishableKey = async () => {
    try {
      await navigator.clipboard.writeText(project.apiKey);
      setCopiedPublishable(true);
      setTimeout(() => setCopiedPublishable(false), 1800);
      toast.success('Publishable key copied to clipboard');
    } catch {
      toast.error('Failed to copy publishable key');
    }
  };

  const handleCopySecretKey = async () => {
    if (!project.secretKey) return;
    try {
      await navigator.clipboard.writeText(project.secretKey);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 1800);
      toast.success('Secret key copied to clipboard');
    } catch {
      toast.error('Failed to copy secret key');
    }
  };

  const handleConfirmRotateKey = async () => {
    if (!rotateKeyType) return;
    setIsRotating(true);
    try {
      const res = await rotateApiKeyAction(project.slug, rotateKeyType);
      if (!res.success || !res.project) {
        toast.error(res.error || 'Failed to rotate API key');
      } else {
        setProject(res.project);
        toast.success(
          `${rotateKeyType === 'public' ? 'Publishable' : 'Secret'} API key rotated successfully`
        );
        setRotateKeyType(null);
      }
    } catch {
      toast.error('Unexpected error rotating API key');
    } finally {
      setIsRotating(false);
    }
  };

  const handleSaveDomains = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDomains(true);
    try {
      const parsedDomains = domains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await updateProjectDomainsAction(project.slug, parsedDomains);
      if (!res.success || !res.project) {
        toast.error(res.error || 'Failed to update domains');
      } else {
        setProject(res.project);
        toast.success('Allowed domains updated successfully');
      }
    } catch {
      toast.error('Unexpected error updating domains');
    } finally {
      setIsSavingDomains(false);
    }
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrivacy(true);
    try {
      const res = await updateProjectPrivacyAction(project.slug, dataRetentionDays, timezone);
      if (!res.success || !res.project) {
        toast.error(res.error || 'Failed to update privacy settings');
      } else {
        setProject(res.project);
        toast.success('Privacy & retention settings updated');
      }
    } catch {
      toast.error('Unexpected error updating privacy settings');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleConfirmPurge = async () => {
    if (!purgeDistinctId.trim()) return;
    setIsPurging(true);
    try {
      const res = await gdprPurgeUserAction(project.slug, purgeDistinctId.trim());
      if (!res.success || !res.result) {
        toast.error(res.error || 'Failed to purge user data');
      } else {
        const { deletedEventsCount, deletedPersonsCount, deletedAliasesCount } = res.result;
        toast.success(
          `User data permanently deleted: ${deletedEventsCount} event(s), ${deletedPersonsCount} person profile(s), and ${deletedAliasesCount} alias(es) removed.`
        );
        setPurgeDistinctId('');
        setIsPurgeDialogOpen(false);
      }
    } catch {
      toast.error('Unexpected error purging user data');
    } finally {
      setIsPurging(false);
    }
  };

  const handleExportEvents = async () => {
    setIsExporting(true);
    try {
      const trimmedId = exportDistinctId.trim();
      const res = await exportUserEventsAction(project.slug, trimmedId || undefined);
      if (!res.success || !res.events) {
        toast.error(res.error || 'Failed to export events');
        return;
      }

      if (res.events.length === 0) {
        toast.info('No events found to export for the given criteria');
        return;
      }

      const jsonString = JSON.stringify(res.events, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      const filenameTarget = trimmedId ? `user-${trimmedId}` : 'all';
      const dateTag = new Date().toISOString().slice(0, 10);
      downloadLink.href = url;
      downloadLink.download = `opentrack-${project.slug}-${filenameTarget}-${dateTag}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      toast.success(
        `Successfully exported ${res.events.length} event${res.events.length === 1 ? '' : 's'} as JSON`
      );
    } catch {
      toast.error('Unexpected error exporting events');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. API Keys Management Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-zinc-400" />
            <CardTitle className="text-base font-semibold text-zinc-100">
              API Keys Management
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Manage your project credentials for client tracking and backend administrative access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Publishable Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-zinc-200">
                  Publishable Key
                </span>
                <p className="text-[11px] text-zinc-500">
                  Client-side ingestion key safe to embed in tracking snippets and SDKs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 font-mono text-xs text-zinc-200 truncate select-all">
                {project.apiKey}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPublishableKey}
                className="gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white"
                title="Copy publishable key"
              >
                {copiedPublishable ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-zinc-200" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotateKeyType('public')}
                className="gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
                title="Rotate publishable key"
              >
                <RotateCw className="h-3.5 w-3.5 text-zinc-400" />
                <span>Rotate</span>
              </Button>
            </div>
          </div>

          <div className="border-t border-zinc-800/50" />

          {/* Secret Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-zinc-200">
                    Secret Admin Key
                  </span>
                  <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-800/40">
                    Confidential
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Server-to-server key for backend ingestion and REST APIs. Never expose in frontend code.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 font-mono text-xs text-zinc-200 truncate select-all">
                {project.secretKey ? (
                  showSecretKey ? (
                    project.secretKey
                  ) : (
                    '••••••••••••••••••••••••••••••••••••••••'
                  )
                ) : (
                  <span className="text-zinc-500 italic">No secret key generated yet</span>
                )}
              </div>
              {project.secretKey && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white"
                  title={showSecretKey ? 'Hide secret key' : 'Show secret key'}
                >
                  {showSecretKey ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Show</span>
                    </>
                  )}
                </Button>
              )}
              {project.secretKey && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecretKey}
                  className="gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white"
                  title="Copy secret key"
                >
                  {copiedSecret ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-zinc-200" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotateKeyType('secret')}
                className="gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
                title={project.secretKey ? 'Rotate secret key' : 'Generate secret key'}
              >
                <RotateCw className="h-3.5 w-3.5 text-zinc-400" />
                <span>{project.secretKey ? 'Rotate' : 'Generate'}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Allowed Domains Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <form onSubmit={handleSaveDomains}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-zinc-400" />
              <CardTitle className="text-base font-semibold text-zinc-100">
                Allowed CORS Domains
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Limit telemetry ingestion to specific origins. Leave blank to accept events from any origin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              id="domains-input"
              type="text"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="e.g. localhost, app.example.com, mycompany.com"
              className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0 transition-colors"
            />
            <p className="text-[11px] text-zinc-500">
              Separate multiple domains with commas. Subdomains must be listed explicitly.
            </p>
          </CardContent>
          <CardFooter className="border-t border-zinc-800/60 pt-3 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSavingDomains}
              className="text-xs font-medium gap-1.5"
            >
              {isSavingDomains && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSavingDomains ? 'Saving...' : 'Save Allowed Domains'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 3. Privacy & Data Retention Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <form onSubmit={handleSavePrivacy}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-400" />
              <CardTitle className="text-base font-semibold text-zinc-100">
                Privacy & Data Retention
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Configure automated data lifecycle retention windows and project timezone for analytics aggregations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data Retention Dropdown */}
              <div className="space-y-1.5">
                <label
                  htmlFor="retention-select"
                  className="text-xs font-medium text-zinc-300"
                >
                  Data Retention Policy
                </label>
                <select
                  id="retention-select"
                  value={dataRetentionDays}
                  onChange={(e) => setDataRetentionDays(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none transition-colors cursor-pointer"
                >
                  {RETENTION_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-zinc-950 text-zinc-200"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500">
                  Historical telemetry older than the retention window is automatically scheduled for cleanup.
                </p>
              </div>

              {/* Timezone Selector Dropdown */}
              <div className="space-y-1.5">
                <label
                  htmlFor="timezone-select"
                  className="text-xs font-medium text-zinc-300"
                >
                  Project Timezone
                </label>
                <select
                  id="timezone-select"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none transition-colors cursor-pointer"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-zinc-950 text-zinc-200"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500">
                  Determines day/week cutoff boundaries in dashboards, insights, and retention heatmaps.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-zinc-800/60 pt-3 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSavingPrivacy}
              className="text-xs font-medium gap-1.5"
            >
              {isSavingPrivacy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSavingPrivacy ? 'Saving...' : 'Save Privacy Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 4. GDPR & Compliance Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-zinc-100">
              GDPR & Compliance Tools
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Fulfill regulatory user privacy requests including GDPR "Right to be Forgotten" deletions and raw event data portability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tool A: Right to be Forgotten (Purge User) */}
          <div className="rounded-lg border border-red-950/40 bg-red-950/10 p-4 space-y-3">
            <div>
              <span className="text-xs font-medium text-red-200 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                Right to be Forgotten (User Data Purge)
              </span>
              <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
                Permanently deletes all events, profile records, and identity aliases matching the provided distinct ID within this project.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                type="text"
                value={purgeDistinctId}
                onChange={(e) => setPurgeDistinctId(e.target.value)}
                placeholder="Enter distinct_id (e.g. user_123 or anonymous uuid)"
                className="text-xs font-mono bg-zinc-900/60 border-zinc-800 placeholder:text-zinc-600 flex-1"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (!purgeDistinctId.trim()) {
                    toast.error('Please enter a distinct ID to purge');
                    return;
                  }
                  setIsPurgeDialogOpen(true);
                }}
                className="text-xs gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Purge User Data</span>
              </Button>
            </div>
          </div>

          {/* Tool B: Data Portability (Export Events) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
            <div>
              <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-zinc-400" />
                Data Portability (Raw Event Export)
              </span>
              <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
                Download raw telemetry events in JSON format for individual data portability requests or project audits.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                type="text"
                value={exportDistinctId}
                onChange={(e) => setExportDistinctId(e.target.value)}
                placeholder="distinct_id (optional, leave blank to export project events)"
                className="text-xs font-mono bg-zinc-900/60 border-zinc-800 placeholder:text-zinc-600 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportEvents}
                disabled={isExporting}
                className="text-xs gap-1.5 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 whitespace-nowrap"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-zinc-400" />
                )}
                <span>{isExporting ? 'Exporting...' : 'Export JSON'}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Project Metadata Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-100">
            Project Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-zinc-400">
          <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
            <span>Name</span>
            <span className="font-medium text-zinc-200">{project.name}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
            <span>Slug</span>
            <span className="font-mono text-zinc-200">{project.slug}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
            <span>Created</span>
            <span className="text-zinc-200">
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span>Scope</span>
            <span className="text-zinc-200">
              {project.clerkOrgId ? `Organization (${project.clerkOrgId})` : 'Personal Workspace'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Rotate Key Confirmation Dialog */}
      <Dialog
        open={rotateKeyType !== null}
        onOpenChange={(open) => !open && !isRotating && setRotateKeyType(null)}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Rotate {rotateKeyType === 'public' ? 'Publishable' : 'Secret'} API Key?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
              {rotateKeyType === 'public'
                ? 'Rotating your publishable API key will invalidate the current key immediately. Any active web tracking snippets or mobile SDKs using the old key will be rejected until updated.'
                : 'Rotating your secret API key will invalidate the current secret key immediately. Any backend ingestion services, export scripts, or API integrations using the current secret key will fail authentication until updated.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotateKeyType(null)}
              disabled={isRotating}
              className="text-xs border-zinc-800 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRotateKey}
              disabled={isRotating}
              className="text-xs gap-1.5"
            >
              {isRotating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isRotating ? 'Rotating...' : 'Rotate Key Now'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR Purge Confirmation Dialog */}
      <Dialog
        open={isPurgeDialogOpen}
        onOpenChange={(open) => !open && !isPurging && setIsPurgeDialogOpen(false)}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5 text-red-500" />
              Permanently Purge User Data?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
              Are you sure you want to permanently delete all data for distinct ID{' '}
              <span className="font-mono font-semibold text-zinc-100 bg-zinc-900 px-1 py-0.5 rounded">
                {purgeDistinctId}
              </span>
              ?
              <br />
              <br />
              This will permanently delete all associated events, person profiles, and identity aliases across this project. This action <span className="font-semibold text-red-400">cannot be undone</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeDialogOpen(false)}
              disabled={isPurging}
              className="text-xs border-zinc-800 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmPurge}
              disabled={isPurging}
              className="text-xs gap-1.5"
            >
              {isPurging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isPurging ? 'Purging...' : 'Permanently Delete User'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
