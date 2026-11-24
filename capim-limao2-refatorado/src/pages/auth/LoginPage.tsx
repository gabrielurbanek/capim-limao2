import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
const { signIn, sendRecovery, configured, loading, profile } = useAuth();
const [showPassword, setShowPassword] = useState(false);
const [recover, setRecover] = useState(false);
const [busy, setBusy] = useState(false);
const [message, setMessage] = useState('');
const [error, setError] = useState('');

if (!loading && profile?.is_active && profile.role) {
return <Navigate to="/admin" replace />;
}

const submit = async (event: FormEvent<HTMLFormElement>) => {
event.preventDefault();
setError('');
setMessage('');
setBusy(true);
const form = new FormData(event.currentTarget);
const email = String(form.get('email') ?? '').trim();

try {
if (recover) {
await sendRecovery(email);
setMessage(
'Se o endereço informado estiver cadastrado, você receberá instruções para redefinir a senha.',
);
} else {
await signIn(email, String(form.get('password') ?? ''));
}
} catch (reason) {
setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o acesso.');
} finally {
setBusy(false);
}
};

return (
<main className="relative grid min-h-screen bg-[#163018] font-sans text-[#2D2D2D] min-[901px]:grid-cols-12">
{/* =================================================================== */}
{/* PAINEL ESQUERDO — OFF-WHITE (#F8F9F5) + RECORTES PAPER-CUT */}
{/* =================================================================== */}
<section className="relative z-10 flex flex-col justify-between bg-[#F8F9F5] px-6 py-8 sm:px-12 sm:py-10 min-[901px]:col-span-6 lg:col-span-5 lg:px-14">
{/* Camadas SVG onduladas simulando recortes de papel sobrepostos */}
<div
className="pointer-events-none absolute -right-14 inset-y-0 hidden w-28 overflow-visible min-[901px]:block"
aria-hidden="true"
>
<svg
viewBox="0 0 120 900"
preserveAspectRatio="none"
className="h-full w-full"
>
<defs>
<filter id="paperEdgeShadow" x="-40%" y="-5%" width="180%" height="110%">
<feDropShadow dx="10" dy="0" stdDeviation="10" floodColor="#0B190C" floodOpacity="0.28" />
</filter>
<filter id="paperLayerShadow" x="-40%" y="-5%" width="180%" height="110%">
<feDropShadow dx="6" dy="0" stdDeviation="7" floodColor="#0B190C" floodOpacity="0.2" />
</filter>
</defs>

{/* Camada traseira verde-lima suave */}
<path
d="M22 0 C78 130, 14 270, 68 420 C118 560, 26 720, 74 900 L0 900 L0 0 Z"
fill="#8CC63F"
fillOpacity="0.34"
filter="url(#paperLayerShadow)"
/>
{/* Camada intermediária creme quente */}
<path
d="M16 0 C64 140, 6 290, 54 440 C98 580, 18 740, 58 900 L0 900 L0 0 Z"
fill="#EFECE4"
filter="url(#paperLayerShadow)"
/>
{/* Camada principal #F8F9F5 */}
<path
d="M8 0 C54 155, -2 310, 44 455 C86 595, 10 755, 44 900 L0 900 L0 0 Z"
fill="#F8F9F5"
filter="url(#paperEdgeShadow)"
/>
</svg>
</div>

{/* Cabeçalho com Logo Oficial */}
<div className="relative z-10 flex items-center justify-between">
<Link to="/" className="inline-flex items-center gap-3 focus:outline-none">
<img
src="/capimlimaodvz.jpg"
alt="Capim Limão — Armazém Natural"
className="h-12 w-auto object-contain"
style={{ mixBlendMode: 'multiply' }}
/>
<div className="flex flex-col leading-none">
<span className="font-serif text-xl font-semibold text-[#18361B]">
Capim Limão
</span>
<span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.22em] text-[#18361B]/65">
Armazém Natural
</span>
</div>
</Link>
</div>

{/* Formulário Centralizado */}
<div className="relative z-10 mx-auto my-10 w-full max-w-md">
<div className="inline-flex items-center gap-2 rounded-full border border-[#18361B]/15 bg-white px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#18361B] shadow-sm">
<Leaf className="h-3.5 w-3.5 text-[#8CC63F]" />
<span>Acesso Administrativo</span>
</div>

<h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.06] tracking-tight text-[#18361B] sm:text-5xl">
{recover ? (
<>
Recupere seu <span className="italic font-normal text-[#C47A3C]">acesso.</span>
</>
) : (
<>
Bom ter você <span className="italic font-normal text-[#C47A3C]">por aqui.</span>
</>
)}
</h1>

<p className="mt-3 text-sm leading-relaxed text-[#2D2D2D]/75">
{recover
? 'Informe o e-mail da sua conta para receber instruções de recuperação.'
: 'Entre com as credenciais fornecidas pela administração do Capim Limão.'}
</p>

{!configured && (
<div className="mt-5 rounded-2xl border border-[#C47A3C]/40 bg-[#C47A3C]/10 px-4 py-3 text-xs leading-relaxed text-[#18361B]">
Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no ambiente para
habilitar o login.
</div>
)}

{error && (
<div
className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-900"
role="alert"
>
{error}
</div>
)}

{message && (
<div
className="mt-5 rounded-2xl border border-[#8CC63F]/50 bg-[#8CC63F]/15 px-4 py-3 text-xs leading-relaxed text-[#18361B]"
role="status"
>
{message}
</div>
)}

<form className="mt-7 space-y-5" onSubmit={submit}>
<div>
<label
htmlFor="login-email"
className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#18361B]/80"
>
E-mail
</label>
<div className="mt-2 flex h-12 items-center gap-3 rounded-2xl border border-[#18361B]/20 bg-white px-4 transition focus-within:border-[#18361B] focus-within:ring-2 focus-within:ring-[#8CC63F]/30">
<Mail className="h-4 w-4 shrink-0 text-[#18361B]/55" />
<input
id="login-email"
name="email"
type="email"
required
autoComplete="email"
placeholder="nome@empresa.com"
className="w-full border-0 bg-transparent p-0 text-sm text-[#2D2D2D] placeholder:text-[#2D2D2D]/40 focus:outline-none focus:ring-0"
/>
</div>
</div>

{!recover && (
<div>
<label
htmlFor="login-password"
className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#18361B]/80"
>
Senha
</label>
<div className="mt-2 flex h-12 items-center gap-3 rounded-2xl border border-[#18361B]/20 bg-white px-4 transition focus-within:border-[#18361B] focus-within:ring-2 focus-within:ring-[#8CC63F]/30">
<LockKeyhole className="h-4 w-4 shrink-0 text-[#18361B]/55" />
<input
id="login-password"
name="password"
type={showPassword ? 'text' : 'password'}
required
autoComplete="current-password"
placeholder="Sua senha"
className="w-full border-0 bg-transparent p-0 text-sm text-[#2D2D2D] placeholder:text-[#2D2D2D]/40 focus:outline-none focus:ring-0"
/>
<button
type="button"
onClick={() => setShowPassword((value) => !value)}
aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
className="rounded-lg p-1 text-[#18361B]/55 transition hover:bg-[#18361B]/5 hover:text-[#18361B]"
>
{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
</div>
</div>
)}

<button
type="submit"
disabled={busy || !configured}
className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#18361B] px-6 text-sm font-semibold text-[#F8F9F5] shadow-md transition hover:bg-[#163018] disabled:cursor-not-allowed disabled:opacity-60"
>
<span>{busy ? 'Aguarde…' : recover ? 'Enviar instruções' : 'Entrar no painel'}</span>
<ArrowRight className="h-4 w-4 text-[#8CC63F]" />
</button>
</form>

<div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
<Link
to="/"
className="inline-flex items-center gap-1.5 font-medium text-[#18361B]/75 transition hover:text-[#18361B]"
>
<ArrowLeft className="h-3.5 w-3.5" />
<span>Voltar à loja</span>
</Link>

{recover ? (
<button
type="button"
onClick={() => {
setRecover(false);
setError('');
setMessage('');
}}
className="font-semibold text-[#C47A3C] hover:underline"
>
Voltar ao login
</button>
) : (
<button
type="button"
onClick={() => {
setRecover(true);
setError('');
setMessage('');
}}
className="font-semibold text-[#C47A3C] hover:underline"
>
Esqueceu sua senha?
</button>
)}
</div>

<p className="mt-4 text-[11px] text-[#2D2D2D]/55">
Acesso restrito à equipe autorizada. Não há cadastro público.
</p>
</div>

{/* Rodapé Institucional */}
<footer className="relative z-10 border-t border-[#18361B]/10 pt-4 text-[11px] font-medium tracking-wide text-[#18361B]/65">
Capim Limão — Armazém Natural · Dois Vizinhos - PR
</footer>
</section>

{/* =================================================================== */}
{/* PAINEL DIREITO — CENÁRIO BOTÂNICO PAPER-CUT (#163018) */}
{/* =================================================================== */}
<aside className="relative hidden overflow-hidden bg-[#163018] min-[901px]:col-span-6 min-[901px]:flex min-[901px]:items-end min-[901px]:justify-start lg:col-span-7">
{/* Ilustração vetorial SVG em múltiplas camadas com sombras projetadas */}
<svg
viewBox="0 0 900 900"
preserveAspectRatio="xMidYMid slice"
className="absolute inset-0 h-full w-full"
aria-hidden="true"
>
<defs>
<filter id="leafPaperShadow1" x="-20%" y="-20%" width="140%" height="140%">
<feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#071208" floodOpacity="0.45" />
</filter>
<filter id="leafPaperShadow2" x="-20%" y="-20%" width="140%" height="140%">
<feDropShadow dx="-8" dy="12" stdDeviation="12" floodColor="#071208" floodOpacity="0.38" />
</filter>
<radialGradient id="botanicalSpot" cx="65%" cy="35%" r="60%">
<stop offset="0%" stopColor="#8CC63F" stopOpacity="0.22" />
<stop offset="55%" stopColor="#18361B" stopOpacity="0.4" />
<stop offset="100%" stopColor="#163018" stopOpacity="1" />
</radialGradient>
</defs>

<rect width="900" height="900" fill="#163018" />
<rect width="900" height="900" fill="url(#botanicalSpot)" />

{/* Camada 1 (fundo): Grandes folhas em verde-floresta profundo */}
<path
d="M420 920 C430 620, 560 400, 860 170 C740 420, 620 680, 520 920 Z"
fill="#1D3F20"
filter="url(#leafPaperShadow1)"
/>
<path
d="M170 920 C240 690, 410 510, 690 360 C550 560, 430 740, 320 920 Z"
fill="#214725"
filter="url(#leafPaperShadow1)"
/>

{/* Camada 2: Folhas médias e hastes de capim-limão */}
<path
d="M520 920 C590 670, 720 470, 920 310 L920 920 Z"
fill="#1A391E"
filter="url(#leafPaperShadow2)"
/>
<path
d="M360 460 C275 340, 295 190, 420 95 C495 215, 460 360, 360 460 Z"
fill="#28562C"
filter="url(#leafPaperShadow1)"
/>
<path
d="M645 345 C565 250, 585 110, 710 35 C770 140, 735 260, 645 345 Z"
fill="#326936"
filter="url(#leafPaperShadow1)"
/>

{/* Camada 3: Folhas de capim-limão em verde-folha vibrante (#8CC63F) e terracota sutil */}
<path
d="M480 650 C520 470, 640 310, 825 195 C725 360, 620 515, 540 675 Z"
fill="#8CC63F"
fillOpacity="0.28"
filter="url(#leafPaperShadow2)"
/>
<path
d="M310 740 C360 560, 460 410, 615 280 C535 445, 445 600, 365 760 Z"
fill="#8CC63F"
fillOpacity="0.45"
filter="url(#leafPaperShadow2)"
/>
<circle
cx="655"
cy="210"
r="72"
fill="#C47A3C"
fillOpacity="0.18"
filter="url(#leafPaperShadow2)"
/>
<path
d="M610 530 C680 430, 795 385, 895 405 C825 495, 715 545, 610 530 Z"
fill="#8CC63F"
fillOpacity="0.65"
filter="url(#leafPaperShadow1)"
/>
</svg>

{/* Cartão Translúcido Inferior */}
<div className="relative z-10 m-10 max-w-lg rounded-3xl border border-[#F8F9F5]/20 bg-[#18361B]/65 p-8 text-[#F8F9F5] shadow-2xl backdrop-blur-md lg:m-14">
<div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8CC63F]">
<Leaf className="h-3.5 w-3.5" />
<span>Gestão do Armazém</span>
</div>
<p className="mt-4 font-serif text-3xl font-medium leading-snug sm:text-4xl">
Um lugar para cuidar de <span className="italic text-[#8CC63F]">cada detalhe</span>
</p>
	<p className="mt-3 text-xs leading-relaxed text-[#F8F9F5]/75">
	Acesse os módulos administrativos de catálogo, estoque, pedidos e ponto de venda conforme suas permissões.
</p>
</div>
</aside>
</main>
);
  }
