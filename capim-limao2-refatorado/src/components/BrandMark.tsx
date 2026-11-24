import { Link } from 'react-router-dom';
import { useCompanySettings } from '../contexts/CompanySettingsContext';
import { useImageUrl } from '../lib/media';

export function BrandMark({ inverse = false, name }: { inverse?: boolean; name?: string }) {
const settings = useCompanySettings();
const displayName = name ?? settings.store_name;
const image = useImageUrl(settings.logo_path);
const logoSrc = image || '/capimlimaodvz.jpg';
const [primary, secondary = ''] = displayName.split(/\s+[—–-]\s+/, 2);

return (
<Link
to="/"
className={`group inline-flex shrink-0 items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C47A3C] focus-visible:ring-offset-2 ${
inverse ? 'text-[#FAF8F5]' : 'text-[#1E472A]'
}`}
aria-label={`${displayName} — início`}
>
<span
className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-[1.03] ${
inverse ? 'bg-[#FAF8F5] px-2 py-1 shadow-sm' : ''
}`}
>
<img
src={logoSrc}
alt=""
className="h-10 w-auto object-contain sm:h-11"
style={{ mixBlendMode: 'multiply' }}
/>
</span>

<span className="flex flex-col whitespace-nowrap leading-none">
<span className="font-serif text-[21px] font-semibold tracking-tight sm:text-[23px]">
{primary || displayName}
</span>
{secondary && (
<small
className={`mt-1 font-sans text-[8px] font-semibold uppercase tracking-[0.2em] ${
inverse ? 'text-[#88C540]' : 'text-[#2D2D2D]/70'
}`}
>
{secondary}
</small>
)}
</span>
</Link>
);
}
