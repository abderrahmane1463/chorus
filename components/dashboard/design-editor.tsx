'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { brandingStyle } from '@/components/branding/brand';
import { LogoMark } from '@/components/shared/logo';
import { TileLetter, tileFor } from '@/components/quiz/answer-tiles';
import { saveBrandingAction } from '@/lib/actions/branding';
import { resizeForUpload } from '@/lib/branding/resize-image';
import {
  assetUrl,
  BRAND_TEMPLATES,
  brandingTokens,
  DEFAULT_BRANDING,
  isHexColour,
  templateOf,
} from '@/lib/branding/templates';
import type { AssetKind } from '@/lib/validations/branding';
import { cn } from '@/lib/utils/cn';
import {
  BRAND_TEMPLATE_IDS,
  MAX_PARTNER_LOGOS,
  type EventBranding,
} from '@/types/branding';

/** Starting points for a brand colour, for a host without one to hand. */
const SWATCHES = [
  '#16a394',
  '#2457e6',
  '#7c3aed',
  '#db2777',
  '#e11d48',
  '#f2762e',
  '#eab308',
  '#16a34a',
];

const UPLOAD_ERRORS: Record<
  string,
  'errorTooLarge' | 'errorNotImage' | 'errorTooMany' | 'errorSlowDown'
> = {
  'too-large': 'errorTooLarge',
  'not-an-image': 'errorNotImage',
  'too-many': 'errorTooMany',
  'slow-down': 'errorSlowDown',
};

export function DesignEditor({
  eventId,
  eventTitle,
  eventCode,
  initial,
  isNew,
}: {
  eventId: string;
  eventTitle: string;
  eventCode: string;
  /** The saved design, or null when the event still has the Chorus look. */
  initial: EventBranding | null;
  /** Shown as the second step of creating an event. */
  isNew: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('design');
  const [design, setDesign] = useState<EventBranding>(initial ?? DEFAULT_BRANDING);
  const [uploading, setUploading] = useState<AssetKind | null>(null);
  const [saving, startSaving] = useTransition();

  const workspace = `/dashboard/events/${eventId}`;
  const changed = JSON.stringify(design) !== JSON.stringify(initial ?? DEFAULT_BRANDING);

  const template = templateOf(design);
  const shownColour = brandingTokens(design)['--primary'];
  const pickedColour = design.accent ?? template.accent;

  function change(patch: Partial<EventBranding>) {
    setDesign((current) => ({ ...current, ...patch }));
  }

  /** Resizes, uploads and returns the new image's id, or null after telling the host why not. */
  async function upload(kind: AssetKind, file: File): Promise<string | null> {
    try {
      const image = await resizeForUpload(file, kind);
      const response = await fetch(`/api/events/${eventId}/assets?kind=${kind}`, {
        method: 'POST',
        body: image,
      });
      const result = (await response.json()) as { ok: boolean; id?: string; error?: string };

      if (result.ok && result.id) return result.id;
      toast.error(t(UPLOAD_ERRORS[result.error ?? ''] ?? 'errorUpload'));
    } catch (error) {
      const unreadable = error instanceof Error && error.message === 'not-an-image';
      toast.error(t(unreadable ? 'errorNotImage' : 'errorUpload'));
    }
    return null;
  }

  async function pick(kind: AssetKind, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(kind);

    if (kind === 'partner') {
      // Several at once, as many as there is still room for.
      const room = MAX_PARTNER_LOGOS - design.partnerIds.length;
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const id = await upload(kind, file);
        if (id) added.push(id);
      }
      if (added.length > 0) {
        setDesign((current) => ({
          ...current,
          partnerIds: [...current.partnerIds, ...added].slice(0, MAX_PARTNER_LOGOS),
        }));
      }
    } else {
      const id = await upload(kind, files[0]);
      if (id) change(kind === 'logo' ? { logoId: id } : { backgroundId: id });
    }

    setUploading(null);
  }

  function save(then: 'stay' | 'continue') {
    startSaving(async () => {
      // Nothing touched on the way through creating an event: leave it as it is.
      if (then === 'continue' && !changed) {
        router.push(workspace);
        return;
      }

      const result = await saveBrandingAction({ eventId, ...design });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t('saved'));
      if (then === 'continue') router.push(workspace);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('template')}</CardTitle>
            <CardDescription>{t('templateHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('template')}>
              {BRAND_TEMPLATE_IDS.map((id) => {
                const option = BRAND_TEMPLATES[id];
                const selected = design.template === id;

                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => change({ template: id })}
                    className={cn(
                      'rounded-lg border p-2 text-start transition-colors',
                      selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:bg-muted',
                    )}
                  >
                    {/* A miniature of the template: its page, a card and its colour. */}
                    <span
                      aria-hidden
                      className="flex h-14 items-end gap-1.5 rounded-md border p-2"
                      style={{
                        backgroundColor: option.surfaces.background,
                        borderColor: option.surfaces.border,
                      }}
                    >
                      <span
                        className="h-6 flex-1 rounded"
                        style={{ backgroundColor: option.surfaces.muted }}
                      />
                      <span className="size-6 rounded" style={{ backgroundColor: option.accent }} />
                    </span>
                    <span className="mt-2 block text-sm font-medium">{t(`templates.${id}`)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(option.mode === 'dark' ? 'dark' : 'light')}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('colour')}</CardTitle>
            <CardDescription>{t('colourHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => change({ accent: swatch })}
                  aria-label={swatch}
                  aria-pressed={pickedColour === swatch}
                  className={cn(
                    'size-8 rounded-full border border-border',
                    pickedColour === swatch && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                  )}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={pickedColour}
                onChange={(event) => change({ accent: event.target.value })}
                aria-label={t('colourPick')}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-card p-1"
              />
              <HexField
                // Remounted when the colour changes elsewhere, so it shows it.
                key={pickedColour}
                value={pickedColour}
                label={t('colourHex')}
                onCommit={(accent) => change({ accent })}
              />
              {design.accent && (
                <Button variant="ghost" size="sm" onClick={() => change({ accent: null })}>
                  <RotateCcw />
                  {t('colourReset')}
                </Button>
              )}
            </div>

            {shownColour !== pickedColour && (
              <p className="text-sm text-muted-foreground">{t('colourAdjusted')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('logo')}</CardTitle>
            <CardDescription>{t('logoHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImageSlot
              assetId={design.logoId}
              plate={design.logoPlate}
              busy={uploading === 'logo'}
              onPick={(files) => pick('logo', files)}
              onRemove={() => change({ logoId: null })}
            />
            <PlateSwitch
              label={t('plate')}
              hint={t('plateHint')}
              checked={design.logoPlate}
              onChange={(logoPlate) => change({ logoPlate })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('partners')}</CardTitle>
            <CardDescription>{t('partnersHint', { max: MAX_PARTNER_LOGOS })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {design.partnerIds.map((id, index) => (
                <div key={id} className="relative">
                  <Thumbnail assetId={id} plate={design.partnerPlate} className="h-16 w-28" />
                  <button
                    type="button"
                    onClick={() =>
                      change({ partnerIds: design.partnerIds.filter((other) => other !== id) })
                    }
                    aria-label={t('removeNumbered', { number: index + 1 })}
                    className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}

              {design.partnerIds.length < MAX_PARTNER_LOGOS && (
                <FileButton
                  multiple
                  busy={uploading === 'partner'}
                  onPick={(files) => pick('partner', files)}
                  className="flex h-16 w-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-muted"
                >
                  <Plus className="size-4" />
                  {uploading === 'partner' ? t('uploading') : t('addLogo')}
                </FileButton>
              )}
            </div>

            <PlateSwitch
              label={t('partnerPlate')}
              hint={t('plateHint')}
              checked={design.partnerPlate}
              onChange={(partnerPlate) => change({ partnerPlate })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('background')}</CardTitle>
            <CardDescription>{t('backgroundHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ImageSlot
              wide
              assetId={design.backgroundId}
              plate={false}
              busy={uploading === 'background'}
              onPick={(files) => pick('background', files)}
              onRemove={() => change({ backgroundId: null })}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          {isNew ? (
            <>
              <Button size="lg" onClick={() => save('continue')} loading={saving} disabled={uploading !== null}>
                {t('saveContinue')}
              </Button>
              <Button variant="ghost" asChild>
                <Link href={workspace}>{t('skip')}</Link>
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              onClick={() => save('stay')}
              loading={saving}
              disabled={!changed || uploading !== null}
            >
              {t('save')}
            </Button>
          )}

          <Button
            variant="ghost"
            className="ms-auto"
            onClick={() => setDesign(DEFAULT_BRANDING)}
            disabled={JSON.stringify(design) === JSON.stringify(DEFAULT_BRANDING)}
          >
            <RotateCcw />
            {t('reset')}
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-sm font-medium text-muted-foreground">{t('preview')}</p>
        <Preview design={design} eventTitle={eventTitle} eventCode={eventCode} />
      </div>
    </div>
  );
}

/** Whether logos sit on a white plate. */
function PlateSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-t border-border pt-4 text-sm">
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** A colour typed as a code. Only a complete, valid code is passed on. */
function HexField({
  value,
  label,
  onCommit,
}: {
  value: string;
  label: string;
  onCommit: (colour: string) => void;
}) {
  const [text, setText] = useState(value);

  return (
    <Input
      value={text}
      onChange={(event) => {
        const next = event.target.value.trim();
        setText(next);
        const withHash = next.startsWith('#') ? next : `#${next}`;
        if (isHexColour(withHash)) onCommit(withHash.toLowerCase());
      }}
      aria-label={label}
      dir="ltr"
      maxLength={7}
      spellCheck={false}
      className="w-28 font-mono"
    />
  );
}

/** A control that opens the file picker. */
function FileButton({
  onPick,
  busy,
  multiple = false,
  className,
  children,
}: {
  onPick: (files: FileList | null) => void;
  busy: boolean;
  multiple?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(event) => {
          onPick(event.target.files);
          // Cleared so choosing the same file again still counts as a change.
          event.target.value = '';
        }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={className}>
        {children}
      </button>
    </>
  );
}

function Thumbnail({
  assetId,
  plate,
  className,
  cover = false,
}: {
  assetId: string;
  plate: boolean;
  className?: string;
  cover?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-md border border-border',
        plate ? 'bg-white' : 'bg-muted',
        !cover && 'p-2',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl(assetId)}
        alt=""
        className={cover ? 'size-full object-cover' : 'max-h-full max-w-full object-contain'}
      />
    </div>
  );
}

/** One image: empty with an upload button, or shown with replace and remove. */
function ImageSlot({
  assetId,
  plate,
  busy,
  wide = false,
  onPick,
  onRemove,
}: {
  assetId: string | null;
  plate: boolean;
  busy: boolean;
  wide?: boolean;
  onPick: (files: FileList | null) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('design');
  const size = wide ? 'h-24 w-44' : 'h-20 w-36';
  const button =
    'inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-4">
      {assetId ? (
        <Thumbnail assetId={assetId} plate={plate} cover={wide} className={size} />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-md border border-dashed border-border text-muted-foreground',
            size,
          )}
        >
          <ImagePlus className="size-5" aria-hidden />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FileButton busy={busy} onPick={onPick} className={button}>
          <Upload className="size-4" />
          {busy ? t('uploading') : assetId ? t('replace') : t('upload')}
        </FileButton>
        {assetId && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 />
            {t('remove')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The design on a small big screen and a small phone.
 *
 * Drawn with the same tokens and the same tiles as the real screens, scoped
 * to this box, so what is shown is what the room will get.
 */
function Preview({
  design,
  eventTitle,
  eventCode,
}: {
  design: EventBranding;
  eventTitle: string;
  eventCode: string;
}) {
  const t = useTranslations('design');
  const answers = [t('sampleA'), t('sampleB'), t('sampleC'), t('sampleD')];
  const backdrop = design.backgroundId ? assetUrl(design.backgroundId) : null;

  const logo = design.logoId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl(design.logoId)}
      alt=""
      className={cn('h-5 w-auto max-w-16 object-contain', design.logoPlate && 'rounded bg-white p-0.5')}
    />
  ) : (
    <LogoMark className="size-5 text-primary" />
  );

  return (
    <div style={brandingStyle(design)} className="space-y-4 text-foreground">
      {/* The big screen. */}
      <div
        className={cn(
          'relative isolate flex aspect-video flex-col overflow-hidden rounded-lg border border-border bg-background',
          !backdrop && 'brand-backdrop',
        )}
        style={
          backdrop
            ? { backgroundImage: `url(${backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {backdrop && <div aria-hidden className="absolute inset-0 -z-10 bg-background/80" />}

        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          {logo}
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{eventTitle}</span>
          <span className="flex size-6 items-center justify-center rounded-full border-2 border-primary text-[9px] font-semibold">
            12
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center px-4 py-2">
          <p className="text-sm font-semibold leading-tight">{t('sampleQuestion')}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {answers.map((answer, index) => (
              <div
                key={answer}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium text-white',
                  tileFor(index).surface,
                )}
              >
                <TileLetter index={index} className="size-4 rounded text-[9px]" />
                <span className="truncate">{answer}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span dir="ltr" className="font-mono text-[10px] font-semibold tracking-widest">
            {eventCode}
          </span>
          <div dir="ltr" className="mx-auto flex items-center gap-2">
            {design.partnerIds.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={id}
                src={assetUrl(id)}
                alt=""
                className={cn('h-4 w-auto max-w-10 object-contain', design.partnerPlate && 'rounded bg-white p-0.5')}
              />
            ))}
          </div>
          <span className="rounded bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">
            {t('sampleNext')}
          </span>
        </div>
      </div>

      {/* The phone. */}
      <div className="mx-auto w-44 overflow-hidden rounded-[1.75rem] border-4 border-border bg-background brand-backdrop">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          {logo}
          <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">{eventTitle}</span>
        </div>
        <div className="space-y-2 px-3 py-3">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
          <p className="text-[11px] font-semibold leading-tight">{t('sampleQuestion')}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {answers.map((answer, index) => (
              <div
                key={answer}
                className={cn(
                  'flex h-12 flex-col justify-between rounded-md p-1.5 text-[9px] font-medium text-white',
                  tileFor(index).surface,
                )}
              >
                <TileLetter index={index} className="size-4 rounded text-[9px]" />
                <span className="truncate">{answer}</span>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-border bg-card px-2 py-1.5 text-[9px] text-muted-foreground">
            {t('samplePlace')}
          </div>
          <div className="rounded-md bg-primary py-1.5 text-center text-[10px] font-semibold text-primary-foreground">
            {t('sampleSubmit')}
          </div>
        </div>
      </div>
    </div>
  );
}
