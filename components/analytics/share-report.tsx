'use client';

import { useState, useTransition } from 'react';
import { Link2, Share2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CopyButton } from '@/components/dashboard/copy-button';
import { createReportShareAction, disableReportSharesAction } from '@/lib/actions/share';
import { cn } from '@/lib/utils/cn';
import { REPORT_SECTIONS, SHARE_DAYS, type ReportSection } from './sections';

/**
 * Shares the report through a public link: the host picks which sections it
 * shows and how long it lasts, and can switch every link off at once.
 */
export function ShareReport({ eventId, activeLinks }: { eventId: string; activeLinks: number }) {
  const t = useTranslations('share');
  const format = useFormatter();
  const [sections, setSections] = useState<ReportSection[]>([...REPORT_SECTIONS]);
  const [days, setDays] = useState<(typeof SHARE_DAYS)[number]>(7);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(section: ReportSection, on: boolean) {
    setSections((current) =>
      on ? REPORT_SECTIONS.filter((s) => s === section || current.includes(s)) : current.filter((s) => s !== section),
    );
    setLink(null);
  }

  function create() {
    startTransition(async () => {
      const result = await createReportShareAction({ eventId, sections, days });
      if (result.ok && result.url && result.expiresAt) {
        setLink({ url: result.url, expiresAt: result.expiresAt });
        toast.success(t('created'));
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function disableAll() {
    startTransition(async () => {
      const result = await disableReportSharesAction({ eventId });
      if (result.ok) {
        setLink(null);
        toast.success(t('disabled'));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setLink(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Share2 />
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('body')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('sectionsLabel')}</legend>
            <div className="space-y-2.5">
              {REPORT_SECTIONS.map((section) => (
                <label key={section} className="flex items-center justify-between gap-3 text-sm">
                  {t(`sections.${section}`)}
                  <Switch
                    checked={sections.includes(section)}
                    onCheckedChange={(on) => toggle(section, on)}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('expiresLabel')}</legend>
            <div className="flex gap-2">
              {SHARE_DAYS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDays(option);
                    setLink(null);
                  }}
                  aria-pressed={days === option}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
                    days === option
                      ? 'border-primary bg-primary-subtle font-medium text-primary'
                      : 'border-border hover:border-primary',
                  )}
                >
                  {t('days', { count: option })}
                </button>
              ))}
            </div>
          </fieldset>

          {link ? (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary-subtle p-3">
              <div className="flex gap-2">
                <Input readOnly value={link.url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <CopyButton value={link.url} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('expiresOn', { date: format.dateTime(new Date(link.expiresAt), { dateStyle: 'medium', timeStyle: 'short' }) })}
              </p>
            </div>
          ) : (
            <Button className="w-full" onClick={create} loading={pending} disabled={sections.length === 0}>
              <Link2 />
              {t('create')}
            </Button>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">{t('active', { count: activeLinks })}</span>
            <Button variant="ghost" size="sm" onClick={disableAll} disabled={pending || activeLinks === 0}>
              {t('disableAll')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
