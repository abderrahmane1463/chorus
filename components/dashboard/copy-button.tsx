'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';

export function CopyButton({
  value,
  label,
  copiedLabel,
  successMessage,
  variant = 'secondary',
  size = 'sm',
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  successMessage?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (successMessage) toast.success(successMessage);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access needs a secure context and can be denied.
      toast.error(t('copyFailed'));
    }
  }

  return (
    <Button variant={variant} size={size} onClick={copy} className={className}>
      {copied ? <Check /> : <Copy />}
      {copied ? (copiedLabel ?? t('copied')) : (label ?? t('copy'))}
    </Button>
  );
}
