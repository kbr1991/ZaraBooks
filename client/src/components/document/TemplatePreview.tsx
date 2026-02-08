import { TemplateId, TEMPLATE_CONFIGS } from '@/lib/document-templates/types';
import { Check } from 'lucide-react';

interface TemplatePreviewProps {
  templateId: TemplateId;
  isSelected?: boolean;
  onSelect?: (templateId: TemplateId) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function TemplatePreview({
  templateId,
  isSelected = false,
  onSelect,
  size = 'md',
}: TemplatePreviewProps) {
  const config = TEMPLATE_CONFIGS.find(t => t.id === templateId);
  if (!config) return null;

  const sizeClasses = {
    sm: 'w-24 h-32',
    md: 'w-32 h-44',
    lg: 'w-40 h-56',
  };

  const templatePreview = getTemplatePreviewSvg(templateId);

  return (
    <button
      onClick={() => onSelect?.(templateId)}
      className={`
        relative flex flex-col items-center gap-2 p-2 rounded-lg transition-all
        ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted'}
        ${onSelect ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <div
        className={`
          ${sizeClasses[size]} rounded-md border overflow-hidden
          ${isSelected ? 'border-primary shadow-md' : 'border-muted-foreground/20'}
        `}
      >
        <div
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: templatePreview }}
        />
      </div>
      {isSelected && (
        <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-1">
          <Check className="h-3 w-3" />
        </div>
      )}
      <div className="text-center">
        <p className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {config.name}
        </p>
        {size !== 'sm' && (
          <p className="text-xs text-muted-foreground mt-0.5 max-w-32">
            {config.description.split(' ').slice(0, 4).join(' ')}...
          </p>
        )}
      </div>
    </button>
  );
}

function getTemplatePreviewSvg(templateId: TemplateId): string {
  const previews: Record<TemplateId, string> = {
    classic: `
      <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <rect width="100" height="140" fill="white"/>
        <rect x="0" y="0" width="100" height="25" fill="#1e3a5f"/>
        <rect x="8" y="8" width="20" height="10" fill="#b8860b" rx="1"/>
        <text x="92" y="16" text-anchor="end" font-size="6" fill="white" font-weight="bold">INVOICE</text>
        <rect x="8" y="35" width="40" height="15" fill="#f8f9fa"/>
        <rect x="8" y="35" width="2" height="15" fill="#b8860b"/>
        <rect x="8" y="58" width="84" height="40" fill="none" stroke="#e5e7eb"/>
        <rect x="8" y="58" width="84" height="8" fill="#1e3a5f"/>
        <rect x="58" y="105" width="34" height="25" fill="#f8f9fa"/>
      </svg>
    `,
    modern: `
      <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <rect width="100" height="140" fill="white"/>
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0ea5e9"/>
            <stop offset="100%" style="stop-color:#14b8a6"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="28" fill="url(#grad1)"/>
        <rect x="6" y="6" width="16" height="16" fill="white" rx="2"/>
        <text x="94" y="18" text-anchor="end" font-size="5" fill="white" opacity="0.9">INVOICE</text>
        <rect x="6" y="38" width="28" height="22" fill="white" stroke="#e5e7eb" rx="4"/>
        <rect x="36" y="38" width="28" height="22" fill="white" stroke="#e5e7eb" rx="4"/>
        <rect x="66" y="38" width="28" height="22" fill="white" stroke="#e5e7eb" rx="4"/>
        <rect x="6" y="68" width="88" height="35" fill="none" stroke="#e0f2fe" rx="4"/>
        <rect x="6" y="68" width="88" height="8" fill="url(#grad1)" rx="4 4 0 0"/>
        <rect x="56" y="108" width="38" height="22" fill="#f0f9ff" stroke="#bae6fd" rx="4"/>
      </svg>
    `,
    professional: `
      <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <rect width="100" height="140" fill="white"/>
        <rect x="6" y="6" width="45" height="25" fill="none" stroke="#111827" stroke-width="1.5"/>
        <rect x="10" y="10" width="15" height="8" fill="#374151"/>
        <text x="10" y="26" font-size="4" fill="#111827" font-weight="bold">COMPANY</text>
        <text x="94" y="14" text-anchor="end" font-size="8" fill="#111827" font-weight="bold">INVOICE</text>
        <line x1="6" y1="40" x2="94" y2="40" stroke="#111827"/>
        <rect x="6" y="48" width="35" height="18" fill="none"/>
        <line x1="6" y1="48" x2="6" y2="66" stroke="#111827" stroke-width="2"/>
        <rect x="6" y="75" width="88" height="35" fill="none" stroke="#e5e7eb"/>
        <rect x="6" y="75" width="88" height="8" fill="#111827"/>
        <rect x="56" y="115" width="38" height="18" fill="none" stroke="#111827" stroke-width="1.5"/>
        <rect x="56" y="127" width="38" height="6" fill="#111827"/>
      </svg>
    `,
    minimal: `
      <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <rect width="100" height="140" fill="white"/>
        <rect x="8" y="12" width="18" height="8" fill="#e5e7eb"/>
        <text x="92" y="12" text-anchor="end" font-size="4" fill="#9ca3af">INVOICE</text>
        <text x="92" y="20" text-anchor="end" font-size="6" fill="#111827">#001</text>
        <text x="8" y="45" font-size="3" fill="#9ca3af">BILLED TO</text>
        <rect x="8" y="48" width="30" height="3" fill="#111827"/>
        <rect x="8" y="53" width="25" height="2" fill="#e5e7eb"/>
        <line x1="8" y1="70" x2="92" y2="70" stroke="#111827" stroke-width="0.5"/>
        <rect x="8" y="75" width="40" height="2" fill="#374151"/>
        <line x1="8" y1="80" x2="92" y2="80" stroke="#f3f4f6"/>
        <rect x="8" y="85" width="35" height="2" fill="#374151"/>
        <line x1="8" y1="90" x2="92" y2="90" stroke="#f3f4f6"/>
        <line x1="60" y1="105" x2="92" y2="105" stroke="#111827" stroke-width="0.5"/>
        <text x="92" y="115" text-anchor="end" font-size="6" fill="#111827" font-weight="500">Total</text>
        <line x1="8" y1="130" x2="92" y2="130" stroke="#f3f4f6"/>
      </svg>
    `,
  };

  return previews[templateId] || previews.classic;
}

interface TemplateGridProps {
  selectedTemplate: TemplateId;
  onSelect: (templateId: TemplateId) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function TemplateGrid({ selectedTemplate, onSelect, size = 'md' }: TemplateGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {TEMPLATE_CONFIGS.map((config) => (
        <TemplatePreview
          key={config.id}
          templateId={config.id}
          isSelected={selectedTemplate === config.id}
          onSelect={onSelect}
          size={size}
        />
      ))}
    </div>
  );
}
