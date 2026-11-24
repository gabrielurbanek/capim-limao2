import { useEffect, useState } from 'react';
import { Download, Settings2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { requireSupabase, supabaseConfigured } from '../../lib/supabase';
import { serializeCsv } from '../../lib/csv';
import { loadReportDataset, reportNames, type ReportKind } from '../../services/reports';

export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('orders');
  const [from, setFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 30); return localDateInput(date); });
  const [to, setTo] = useState(() => localDateInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const exportReport = async (format: 'pdf' | 'csv') => {
    setBusy(true); setMessage(''); setError('');
    try {
      if (!from || !to || from > to) throw new Error('Informe um intervalo de datas válido.');
      requireSupabase();
      const dataset = await loadReportDataset(kind, from, to);
      const filename = `capim-limao-${kind}-${from}-${to}`;
      if (format === 'csv') {
        downloadTextFile(serializeCsv([dataset.columns, ...dataset.rows]), `${filename}.csv`, 'text/csv;charset=utf-8');
      } else {
        const doc = new jsPDF({ format: 'a4', unit: 'mm' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('Capim Limão — Armazém Natural', 14, 17);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(dataset.title, 14, 24);
        doc.text(`Período: ${new Date(`${from}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${to}T00:00:00`).toLocaleDateString('pt-BR')}`, 14, 30);
        doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, 14, 36);
        if (dataset.summary) { doc.setFont('helvetica', 'bold'); doc.text(dataset.summary, 14, 43); doc.setFont('helvetica', 'normal'); }
        autoTable(doc, { startY: dataset.summary ? 50 : 42, head: [dataset.columns], body: dataset.rows.length ? dataset.rows : [['Sem registros no período']], theme: 'grid', styles: { fontSize: 8, cellPadding: 2.4, overflow: 'linebreak' }, headStyles: { fillColor: [30, 71, 42], textColor: 255 }, alternateRowStyles: { fillColor: [245, 244, 239] }, margin: { left: 14, right: 14 } });
        doc.save(`${filename}.pdf`);
      }
      setMessage(`${format.toUpperCase()} gerado com ${dataset.rows.length} registro${dataset.rows.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o relatório.');
    } finally { setBusy(false); }
  };

  if (!supabaseConfigured) return <div className="admin-setup"><div className="eyebrow">DADOS REAIS</div><h1>Relatórios<em>.</em></h1><div className="setup-warning">Conecte Supabase para gerar arquivos a partir de registros reais.</div></div>;
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">ANÁLISE OPERACIONAL</div><h1>Relatórios<em>.</em></h1><p>Exporte consultas reais para PDF A4 ou CSV.</p></div></div>
    {error && <div className="admin-error" role="alert">{error}</div>}{message && <div className="success-note" role="status">{message}</div>}
    <div className="report-builder"><div className="report-builder__icon"><Download size={21} /></div><div className="report-builder__copy"><span>EXPORTAÇÃO · PDF A4 / CSV</span><h2>Gerar relatório</h2><p>Os dados vêm do banco e respeitam as permissões aplicadas pelo Supabase.</p>{kind === 'revenue' && <p className="form-hint">Inclui pedidos atualmente pagos e parcelas PDV confirmadas; o período segue a data de criação do pedido/venda disponível no schema, não a data da liquidação bancária. O estado operacional e o financeiro são distintos.</p>}{kind === 'products' && <p className="form-hint">O subtotal agrega valores de linha e não rateia descontos aplicados ao total da venda.</p>}</div><div className="report-form"><label>Tipo de relatório<select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)}>{Object.entries(reportNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Data inicial<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Data final<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><div className="flex flex-wrap gap-2"><button type="button" className="button button--admin" disabled={busy} onClick={() => void exportReport('pdf')}>{busy ? 'Preparando…' : 'Baixar PDF'} <Download size={15} /></button><button type="button" className="button button--outline" disabled={busy} onClick={() => void exportReport('csv')}>{busy ? 'Preparando…' : 'Baixar CSV'} <Download size={15} /></button></div></div></div>
    <div className="report-kind-grid">{Object.entries(reportNames).map(([key, name], index) => <button type="button" key={key} aria-pressed={kind === key} className={kind === key ? 'selected' : ''} onClick={() => setKind(key as ReportKind)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><Download size={15} /></button>)}</div>
  </section>;
}

function localDateInput(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function downloadTextFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface CompanySettings {
  store_name: string; logo_path: string | null; description: string | null; whatsapp: string | null; email: string | null; address: string | null;
  opening_hours: string; social_links: string; banner_path: string | null; announcement: string | null; footer_text: string | null; differentiators: string;
}
const defaultSettings: CompanySettings = { store_name: 'Capim Limão — Armazém Natural', logo_path: null, description: null, whatsapp: '554635366291', email: null, address: null, opening_hours: '', social_links: '', banner_path: null, announcement: null, footer_text: null, differentiators: '' };

function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
function parseJson(value: string): unknown {
  if (!value.trim()) return null;
  try { return JSON.parse(value); } catch { throw new Error('Revise os campos JSON de horários, redes sociais e diferenciais.'); }
}

export function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [formVersion, setFormVersion] = useState(0);
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) return;
    setLoading(true);
    void (async () => {
      const { data, error: queryError } = await requireSupabase().from('company_settings')
        .select('store_name,logo_path,description,whatsapp,email,address,opening_hours,social_links,banner_path,announcement,footer_text,differentiators').eq('id', true).maybeSingle();
      if (queryError) setError('Não foi possível carregar as configurações.');
      else if (data) {
        setSettings({ ...defaultSettings, ...data, opening_hours: stringifyJson(data.opening_hours), social_links: stringifyJson(data.social_links), differentiators: stringifyJson(data.differentiators) });
        setFormVersion((value) => value + 1);
      }
    })().finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const next: Record<string, unknown> = {
        store_name: String(form.get('store_name') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || null,
        whatsapp: String(form.get('whatsapp') ?? '').replace(/\D/g, '') || null,
        email: String(form.get('email') ?? '').trim() || null,
        address: String(form.get('address') ?? '').trim() || null,
        opening_hours: parseJson(String(form.get('opening_hours') ?? '')),
        social_links: parseJson(String(form.get('social_links') ?? '')),
        announcement: String(form.get('announcement') ?? '').trim() || null,
        footer_text: String(form.get('footer_text') ?? '').trim() || null,
        differentiators: parseJson(String(form.get('differentiators') ?? '')),
      };
      const client = requireSupabase();
      const upload = async (file: File | null, prefix: string) => {
        if (!file) return null;
        if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Imagem inválida: JPEG, PNG ou WebP de até 5 MB.');
        const path = `company/${prefix}-${crypto.randomUUID()}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'}`;
        const { error: uploadError } = await client.storage.from('product-images').upload(path, file, { contentType: file.type });
        if (uploadError) throw new Error('Upload de imagem recusado pelo Storage.');
        return path;
      };
      const logoPath = await upload(logo, 'logo'); const bannerPath = await upload(banner, 'banner');
      if (logoPath) next.logo_path = logoPath;
      if (bannerPath) next.banner_path = bannerPath;
      const { error: updateError } = await client.from('company_settings').upsert({ id: true, ...next }, { onConflict: 'id' });
      if (updateError) throw new Error('Não foi possível salvar. Somente OWNER pode alterar configurações.');
      setNotice('Configurações salvas.'); setLogo(null); setBanner(null);
      setSettings((previous) => ({ ...previous, ...next, logo_path: logoPath ?? previous.logo_path, banner_path: bannerPath ?? previous.banner_path }) as CompanySettings);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao salvar configurações.'); }
    finally { setBusy(false); }
  };
  const pickImage = (event: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
    const file = event.target.files?.[0] ?? null;
    if (file && (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Use uma imagem JPEG, PNG ou WebP de até 5 MB.'); return; }
    setError(''); setter(file);
  };

  if (!supabaseConfigured) return <div className="admin-setup"><div className="eyebrow">IDENTIDADE DA LOJA</div><h1>Configurações<em>.</em></h1><div className="setup-warning">Configure Supabase para editar as informações institucionais.</div></div>;
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">IDENTIDADE E CONTEÚDO</div><h1>Configurações<em>.</em></h1><p>Conteúdo editável da empresa e da loja pública.</p></div><span className="admin-owner-badge">OWNER</span></div>
    {error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}{loading && <p className="admin-loading">Carregando configuração persistida…</p>}
    <form key={formVersion} className="settings-form" onSubmit={save}>
      <section className="settings-card"><div className="settings-card__heading"><Settings2 size={17} /><div><span>DADOS DA EMPRESA</span><h2>Identificação e atendimento</h2></div></div><div className="settings-grid">
        <label className="span-2">Nome da empresa<input name="store_name" required defaultValue={settings.store_name} /></label>
        <label className="span-2">Descrição<textarea name="description" rows={3} defaultValue={settings.description ?? ''} placeholder="Preencha somente com informações confirmadas pela loja." /></label>
        <label>WhatsApp<input name="whatsapp" inputMode="tel" defaultValue={settings.whatsapp ?? ''} /></label>
        <label>E-mail<input name="email" type="email" defaultValue={settings.email ?? ''} /></label>
        <label className="span-2">Endereço<input name="address" defaultValue={settings.address ?? ''} /></label>
        <label>Horários (JSON)<textarea name="opening_hours" rows={3} defaultValue={settings.opening_hours} placeholder='{"segunda":"09:00–18:00"}' /></label>
        <label>Redes sociais (JSON)<textarea name="social_links" rows={3} defaultValue={settings.social_links} placeholder='{"instagram":"https://…"}' /></label>
      </div></section>
      <section className="settings-card"><div className="settings-card__heading"><Settings2 size={17} /><div><span>CONTEÚDO DA LOJA</span><h2>Textos e imagens</h2></div></div><div className="settings-grid">
        <label>Aviso do topo<textarea name="announcement" rows={2} defaultValue={settings.announcement ?? ''} /></label>
        <label>Rodapé<textarea name="footer_text" rows={2} defaultValue={settings.footer_text ?? ''} /></label>
        <label className="span-2">Diferenciais (JSON)<textarea name="differentiators" rows={3} defaultValue={settings.differentiators} placeholder='["Texto informado pela loja"]' /></label>
        <label>Logo da empresa<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => pickImage(event, setLogo)} /><small>{logo?.name || (settings.logo_path ? 'Imagem armazenada' : 'Nenhuma imagem enviada')}</small></label>
        <label>Banner da loja<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => pickImage(event, setBanner)} /><small>{banner?.name || (settings.banner_path ? 'Imagem armazenada' : 'Nenhuma imagem enviada')}</small></label>
      </div></section>
      <div className="settings-actions"><p>Informações ausentes permanecem em branco. Valores iniciais se limitam ao nome e WhatsApp já confirmados.</p><button className="button button--admin" disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'} <span>↗</span></button></div>
    </form>
  </section>;
}
