'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { Event, EventCategory, EventVisibility, EventCategoryRecord, PreferenceTagRecord, EventGroupCreationMode, EventGroupUserSource, ServiceRoleRecord } from '@/types/database';

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'));

interface EventFormProps {
  event?: Event;
  isEditing?: boolean;
}

export default function EventForm({ event, isEditing = false }: EventFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pois, setPois] = useState<{ id: string; nome: string }[]>([]);
  const [categories, setCategories] = useState<EventCategoryRecord[]>([]);
  const [tags, setTags] = useState<PreferenceTagRecord[]>([]);
  // Helper: formatta una data ISO in formato datetime-local (fuso locale)
  const toLocalDatetimeString = (isoStr: string) => {
    const d = new Date(isoStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    title: event?.title || '',
    custom_id: event?.custom_id || '',
    description: event?.description || '',
    category: event?.category || '' as EventCategory,
    tags: event?.tags || [],
    location_poi_id: event?.location_poi_id || '',
    start_time: event?.start_time
      ? toLocalDatetimeString(event.start_time)
      : '',
    end_time: event?.end_time
      ? toLocalDatetimeString(event.end_time)
      : '',
    max_posti: event?.max_posti || 50,
    speaker_name: event?.speaker_name || '',
    speaker_bio: event?.speaker_bio || '',
    is_published: event?.is_published || false,
    publish_at: event?.publish_at ? toLocalDatetimeString(event.publish_at) : '',
    auto_enroll_all: event?.auto_enroll_all || false,
    checkin_enabled: event?.checkin_enabled || false,
    user_can_upload_assets: event?.user_can_upload_assets || false,
    workshop_groups_count: event?.workshop_groups_count || 0,
    group_creation_mode: event?.group_creation_mode || 'random' as EventGroupCreationMode,
    group_user_source: event?.group_user_source || 'event_registrants' as EventGroupUserSource,
    source_event_id: event?.source_event_id || '',
    group_eligible_roles: event?.group_eligible_roles || [],
    max_group_size: event?.max_group_size || 10,
    avg_people_per_group: event?.avg_people_per_group ?? null,
    auto_create_groups_at_start: event?.auto_create_groups_at_start ?? false,
    visibility: event?.visibility || 'public' as EventVisibility,
    is_placeholder: event?.is_placeholder || false,
    registrations_open_at: event?.registrations_open_at ? toLocalDatetimeString(event.registrations_open_at) : '',
    registrations_close_at: event?.registrations_close_at ? toLocalDatetimeString(event.registrations_close_at) : '',
  });

  const [isRecurring, setIsRecurring] = useState(false);
  const [occurrences, setOccurrences] = useState(1);
  const [groupSizeMode, setGroupSizeMode] = useState<'count' | 'avg'>(
    event?.avg_people_per_group ? 'avg' : 'count'
  );
  const [groupWizardStep, setGroupWizardStep] = useState<number>(() => {
    if (!event?.group_creation_mode) return 1;
    return ['static_crm', 'copy'].includes(event.group_creation_mode) ? 2 : 4;
  });

  const [workshopEvents, setWorkshopEvents] = useState<{ id: string; title: string; start_time: string }[]>([]);
  const [serviceRoles, setServiceRoles] = useState<ServiceRoleRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [poisRes, categoriesRes, tagsRes, eventsRes, rolesRes] = await Promise.all([
          fetch('/api/admin/poi'),
          fetch('/api/categories'),
          fetch('/api/tags'),
          fetch('/api/admin/events'),
          fetch('/api/service-roles'),
        ]);

        if (!poisRes.ok) throw new Error('Failed to fetch POIs');
        if (!categoriesRes.ok) throw new Error('Failed to fetch categories');
        if (!tagsRes.ok) throw new Error('Failed to fetch tags');
        if (!eventsRes.ok) throw new Error('Failed to fetch events');

        const [poisData, categoriesData, tagsData, eventsData, rolesData] = await Promise.all([
          poisRes.json(),
          categoriesRes.json(),
          tagsRes.json(),
          eventsRes.json(),
          rolesRes.json(),
        ]);

        setPois(poisData.data || []);
        setCategories(categoriesData.data || []);
        setTags(tagsData.data || []);
        if (rolesData.data) setServiceRoles(rolesData.data);

        const wEvents = (eventsData.data || [])
          .filter((e: any) => {
            {
              const cat = (categoriesData.data || []).find((c: any) => c.slug === e.category);
              return cat?.has_groups && e.id !== event?.id;
            }
          })
          .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        setWorkshopEvents(wEvents);
      } catch (error) {
        console.error(error);
        setError('Impossibile caricare i dati del form.');
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/admin/events/${event?.id}`
        : '/api/admin/events';

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: formData.end_time
            ? new Date(formData.end_time).toISOString()
            : null,
          publish_at: formData.publish_at
            ? new Date(formData.publish_at).toISOString()
            : null,
          registrations_open_at: formData.registrations_open_at
            ? new Date(formData.registrations_open_at).toISOString()
            : null,
          registrations_close_at: formData.registrations_close_at
            ? new Date(formData.registrations_close_at).toISOString()
            : null,
          occurrences: isRecurring && !isEditing ? occurrences : 1,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante il salvataggio');
      }

      router.push('/admin/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Informazioni Base</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titolo *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              className="input w-full"
              placeholder="Titolo dell'evento"
            />
          </div>

          {formData.category === 'laboratorio' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codice Laboratorio (ID)
              </label>
              <input
                type="text"
                value={formData.custom_id}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_id: e.target.value }))}
                className="input w-full"
                placeholder="Es. L1, 002 (usato per ordinare i lab in lista)"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <Suspense fallback={<div className="input w-full min-h-[120px] animate-pulse bg-gray-100" />}>
              <RichTextEditor
                initialHtml={event?.description || ''}
                onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                placeholder="Descrizione dettagliata dell'evento"
              />
            </Suspense>
          </div>

          <div className={`grid gap-4 ${formData.auto_enroll_all ? '' : 'sm:grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as EventCategory }))}
                required
                className="input w-full"
              >
                <option value="" disabled>Seleziona categoria</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {!formData.auto_enroll_all && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Posti massimi *
                </label>
                <input
                  type="number"
                  value={formData.max_posti}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_posti: parseInt(e.target.value) || 0 }))}
                  required
                  min={1}
                  className="input w-full"
                />
              </div>
            )}
          </div>

          {/* Sezione gruppi — wizard sequenziale */}
          {categories.find(c => c.slug === formData.category)?.has_groups && (() => {
            const mode = formData.group_creation_mode;
            const maxStep = ['static_crm', 'copy'].includes(mode) ? 2 : 4;
            const groupsEnabled = formData.workshop_groups_count > 0
              || !!formData.avg_people_per_group
              || ['copy', 'homogeneous', 'static_crm', 'cluster_service'].includes(mode);

            // Summary labels for completed steps
            const step1Value = formData.auto_enroll_all
              ? 'Iscritti BC (automatico)'
              : formData.group_user_source === 'bc_list'
              ? 'Lista iscritti BC'
              : `Iscritti all'evento${formData.auto_create_groups_at_start ? ' · auto-creazione attiva' : ''}`;

            const modeLabels: Record<string, string> = {
              random: 'Casuale', mix_roles: 'Ruoli equamente distribuiti',
              homogeneous: 'Raggruppa ruoli omogenei', static_crm: 'Gruppi Statici CRM', copy: 'Copia evento precedente',
              cluster_service: 'Per cluster di servizio',
            };
            const step2Value = modeLabels[mode] || mode;

            const step3Value = (mode === 'homogeneous' || mode === 'cluster_service')
              ? `Max ${formData.max_group_size} per cluster`
              : groupSizeMode === 'count'
              ? `${formData.workshop_groups_count} gruppi`
              : `~${formData.avg_people_per_group} persone/gruppo`;

            const step4Value = formData.group_eligible_roles.length === 0
              ? 'Tutti i ruoli inclusi'
              : `${formData.group_eligible_roles.length} ruol${formData.group_eligible_roles.length === 1 ? 'o' : 'i'} selezionati`;

            const stepBadge = (n: number) => (
              <span className="flex-shrink-0 w-5 h-5 bg-agesci-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">{n}</span>
            );

            const stepTitle = (n: number, label: string) => (
              <div className="flex items-center gap-2 mb-3">
                {stepBadge(n)}
                <span className="text-sm font-semibold text-gray-800">{label}</span>
              </div>
            );

            const stepSummary = (n: number, label: string, value: string, onEdit: () => void) => (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-lg border border-green-100">
                <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-green-600 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-gray-800 font-medium truncate">{value}</p>
                </div>
                <button type="button" onClick={onEdit} className="text-xs text-agesci-blue hover:underline font-medium flex-shrink-0">Modifica</button>
              </div>
            );

            const continueBtn = (onClick: () => void, label = 'Continua →') => (
              <div className="flex justify-end pt-2">
                <button type="button" onClick={onClick}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-agesci-blue rounded-lg hover:bg-agesci-blue-light transition-colors">
                  {label}
                </button>
              </div>
            );

            return (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                {/* Toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">Gruppi di Lavoro</h3>
                    <p className="text-sm text-gray-500">Abilita la creazione di gruppi di lavoro per questo evento</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
                    <input type="checkbox" checked={groupsEnabled}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setFormData(prev => ({ ...prev, workshop_groups_count: 0, avg_people_per_group: null, source_event_id: '', group_eligible_roles: [], group_creation_mode: 'random', auto_create_groups_at_start: false }));
                          setGroupWizardStep(1);
                        } else {
                          setFormData(prev => ({ ...prev, workshop_groups_count: 4 }));
                          setGroupSizeMode('count');
                          setGroupWizardStep(1);
                        }
                      }}
                      className="sr-only peer" />
                    <div className="relative w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {groupsEnabled && (
                  <div className="space-y-2 pl-0 sm:pl-4 border-l-0 sm:border-l-2 sm:border-blue-200">

                    {/* ── STEP 1 ── */}
                    {groupWizardStep > 1 && stepSummary(1, 'Sorgente utenti', step1Value, () => setGroupWizardStep(1))}
                    {groupWizardStep === 1 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        {stepTitle(1, 'Sorgente utenti')}
                        {formData.auto_enroll_all ? (
                          <div className="text-sm text-blue-700 bg-blue-50 rounded-md p-3 flex gap-2">
                            <span>ℹ️</span>
                            <span>Iscrizione automatica attiva — la lista utenti sarà sempre quella degli iscritti BC.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border bg-white hover:border-agesci-blue transition-colors" style={{ borderColor: formData.group_user_source === 'bc_list' ? undefined : undefined }}>
                              <input type="radio" name="group_user_source" value="bc_list"
                                checked={formData.group_user_source === 'bc_list'}
                                onChange={() => setFormData(prev => ({ ...prev, group_user_source: 'bc_list', auto_create_groups_at_start: false }))}
                                className="mt-0.5 text-blue-600" />
                              <div>
                                <span className="text-sm font-medium text-gray-800">Lista iscritti BC</span>
                                <p className="text-xs text-gray-500 mt-0.5">Gruppi pre-determinati al salvataggio dell&apos;evento</p>
                              </div>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border bg-white hover:border-agesci-blue transition-colors">
                              <input type="radio" name="group_user_source" value="event_registrants"
                                checked={formData.group_user_source === 'event_registrants'}
                                onChange={() => setFormData(prev => ({ ...prev, group_user_source: 'event_registrants' }))}
                                className="mt-0.5 text-blue-600" />
                              <div>
                                <span className="text-sm font-medium text-gray-800">Iscritti all&apos;evento</span>
                                <p className="text-xs text-gray-500 mt-0.5">Solo chi si iscrive autonomamente — gruppi creati manualmente o in automatico</p>
                              </div>
                            </label>
                            {formData.group_user_source === 'event_registrants' && (
                              <div className="ml-4 flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200">
                                <div>
                                  <p className="text-sm font-medium text-gray-800">Crea gruppi automaticamente all&apos;inizio</p>
                                  <p className="text-xs text-gray-500">Se non creati manualmente, il sistema li genera all&apos;ora di inizio</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                  <input type="checkbox" checked={formData.auto_create_groups_at_start}
                                    onChange={(e) => setFormData(prev => ({ ...prev, auto_create_groups_at_start: e.target.checked }))}
                                    className="sr-only peer" />
                                  <div className="relative w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                        {continueBtn(() => setGroupWizardStep(2))}
                      </div>
                    )}

                    {/* ── STEP 2 ── */}
                    {groupWizardStep > 2 && stepSummary(2, 'Modalità di generazione', step2Value, () => setGroupWizardStep(2))}
                    {groupWizardStep === 2 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        {stepTitle(2, 'Modalità di generazione')}
                        <div className="space-y-1">
                          {[
                            { value: 'random', label: 'Casuale', desc: 'Distribuzione casuale dei partecipanti' },
                            { value: 'mix_roles', label: 'Ruoli equamente distribuiti', desc: 'Ogni gruppo riceve una proporzione bilanciata di ruoli' },
                            { value: 'homogeneous', label: 'Raggruppa ruoli omogenei', desc: 'Ogni gruppo è composto da persone con lo stesso ruolo' },
                            { value: 'static_crm', label: 'Usa i gruppi Statici del CRM', desc: 'I partecipanti vengono assegnati in base al loro gruppo statico' },
                            { value: 'copy', label: 'Copia da evento precedente', desc: 'Replica la struttura gruppi di un evento già svolto' },
                            { value: 'cluster_service', label: 'Per cluster di servizio', desc: 'Raggruppa i partecipanti dello stesso cluster insieme' },
                          ].map(opt => (
                            <label key={opt.value} className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg border border-transparent hover:bg-white hover:border-gray-200 transition-colors">
                              <input type="radio" name="group_creation_mode" value={opt.value}
                                checked={mode === opt.value}
                                onChange={() => setFormData(prev => ({ ...prev, group_creation_mode: opt.value as EventGroupCreationMode, source_event_id: opt.value !== 'copy' ? '' : prev.source_event_id }))}
                                className="mt-0.5 text-blue-600 focus:ring-blue-500" />
                              <div>
                                <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                                <p className="text-xs text-gray-500">{opt.desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                        {mode === 'copy' && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Evento di origine *</label>
                            <select value={formData.source_event_id}
                              onChange={(e) => setFormData(prev => ({ ...prev, source_event_id: e.target.value }))}
                              required={mode === 'copy'} className="input w-full">
                              <option value="" disabled>Seleziona un evento passato</option>
                              {workshopEvents.map(we => (
                                <option key={we.id} value={we.id}>
                                  {we.title} ({new Date(we.start_time).toLocaleDateString('it-IT')})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {maxStep > 2 && continueBtn(() => setGroupWizardStep(3))}
                      </div>
                    )}

                    {/* ── STEP 3 — only for random / mix_roles / homogeneous ── */}
                    {maxStep >= 3 && groupWizardStep > 3 && stepSummary(3, 'Dimensione gruppi', step3Value, () => setGroupWizardStep(3))}
                    {maxStep >= 3 && groupWizardStep === 3 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        {stepTitle(3, 'Dimensione gruppi')}
                        {(mode === 'homogeneous' || mode === 'cluster_service') ? (
                          <div>
                            <label className="block text-sm text-gray-700 mb-1">
                              {mode === 'cluster_service' ? 'Dimensione massima per gruppo (per cluster)' : 'Dimensione massima per gruppo (per ruolo)'}
                            </label>
                            <input type="number" value={formData.max_group_size}
                              onChange={(e) => setFormData(prev => ({ ...prev, max_group_size: parseInt(e.target.value) || 1 }))}
                              min={1} required className="input w-full" />
                            <p className="text-xs text-gray-500 mt-1">
                              {mode === 'cluster_service'
                                ? 'Se un cluster supera questo limite vengono creati più gruppi per quel cluster.'
                                : 'Se un ruolo supera questo limite vengono creati più gruppi per quel ruolo.'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="group_size_mode" checked={groupSizeMode === 'count'}
                                  onChange={() => { setGroupSizeMode('count'); setFormData(prev => ({ ...prev, avg_people_per_group: null, workshop_groups_count: prev.workshop_groups_count || 4 })); }}
                                  className="text-blue-600" />
                                <span className="text-sm text-gray-800">Numero di gruppi</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="group_size_mode" checked={groupSizeMode === 'avg'}
                                  onChange={() => { setGroupSizeMode('avg'); setFormData(prev => ({ ...prev, workshop_groups_count: 0, avg_people_per_group: prev.avg_people_per_group || 10 })); }}
                                  className="text-blue-600" />
                                <span className="text-sm text-gray-800">Media persone / gruppo</span>
                              </label>
                            </div>
                            {groupSizeMode === 'count' ? (
                              <>
                                <input type="number" value={formData.workshop_groups_count || ''}
                                  onChange={(e) => setFormData(prev => ({ ...prev, workshop_groups_count: parseInt(e.target.value) || 0 }))}
                                  min={1} placeholder="es. 8" className="input w-full" />
                                <p className="text-xs text-gray-500">I partecipanti saranno distribuiti in questo numero di gruppi.</p>
                              </>
                            ) : (
                              <>
                                <input type="number" value={formData.avg_people_per_group || ''}
                                  onChange={(e) => setFormData(prev => ({ ...prev, avg_people_per_group: parseInt(e.target.value) || null }))}
                                  min={1} placeholder="es. 10" className="input w-full" />
                                <p className="text-xs text-gray-500">Il numero di gruppi verrà calcolato al momento della generazione.</p>
                              </>
                            )}
                          </div>
                        )}
                        {continueBtn(() => setGroupWizardStep(4))}
                      </div>
                    )}

                    {/* ── STEP 4 — only for random / mix_roles / homogeneous ── */}
                    {maxStep >= 4 && groupWizardStep === 4 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        {stepTitle(4, 'Ruoli di servizio da includere')}
                        <p className="text-xs text-gray-500 mb-3">Se nessuno è selezionato, tutti i ruoli saranno inclusi.</p>
                        <div className="grid grid-cols-2 gap-1">
                          {serviceRoles.map(role => (
                            <label key={role.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors">
                              <input type="checkbox"
                                checked={formData.group_eligible_roles.includes(role.name)}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  group_eligible_roles: e.target.checked
                                    ? [...prev.group_eligible_roles, role.name]
                                    : prev.group_eligible_roles.filter(r => r !== role.name),
                                }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                              <span className="text-sm text-gray-800">{role.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Luogo (POI) *
            </label>
            <select
              value={formData.location_poi_id}
              onChange={(e) => setFormData(prev => ({ ...prev, location_poi_id: e.target.value }))}
              required
              className="input w-full"
            >
              <option value="" disabled>Seleziona un luogo</option>
              {pois.map((poi) => (
                <option key={poi.id} value={poi.id}>
                  {poi.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Data e Ora</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inizio *
            </label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              required
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fine
            </label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              className="input w-full"
            />
          </div>
        </div>

        {/* Opzioni Aggiuntive e Ricorrenza */}
        {!isEditing && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.is_placeholder}
                onChange={(e) => setFormData(prev => ({ ...prev, is_placeholder: e.target.checked }))}
                className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
              />
              <div>
                <span className="block text-sm font-medium text-gray-900">Evento Segnaposto (es. Pausa, Pranzo)</span>
                <span className="block text-xs text-gray-500 mt-1">Non permette iscrizioni e appare in grigio tratteggiato sul calendario.</span>
              </div>
            </label>

            <div className="flex flex-col gap-3 p-4 border rounded-lg bg-gray-50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-900">Ripeti Evento (Ogni giorno)</span>
              </label>
              
              {isRecurring && (
                <div className="pl-8 pt-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Per</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={occurrences}
                    onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)}
                    className="input w-20 py-1.5 px-2"
                  />
                  <span className="text-sm text-gray-600">giorni consecutivi</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Speaker */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Speaker</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Speaker
            </label>
            <input
              type="text"
              value={formData.speaker_name}
              onChange={(e) => setFormData(prev => ({ ...prev, speaker_name: e.target.value }))}
              className="input w-full"
              placeholder="Nome e cognome dello speaker"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio Speaker
            </label>
            <Suspense fallback={<div className="input w-full min-h-[120px] animate-pulse bg-gray-100" />}>
              <RichTextEditor
                initialHtml={event?.speaker_bio || ''}
                onChange={(html) => setFormData(prev => ({ ...prev, speaker_bio: html }))}
                placeholder="Breve biografia dello speaker"
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Tags - Touch friendly */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Tag (per raccomandazioni)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Seleziona i tag che descrivono l&apos;evento. Questi verranno usati per consigliare l&apos;evento agli utenti.
        </p>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          {tags.map((tag) => (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggleTag(tag.slug)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] active:scale-95 ${formData.tags.includes(tag.slug)
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Publish & Visibility */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
        {/* Publish Toggle - Larger for touch */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Pubblica</h2>
            <p className="text-sm text-gray-500">
              Gli eventi pubblicati sono visibili agli utenti
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="relative w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Scheduled publish time */}
        {formData.is_published && (
          <div className="pl-0 border-l-0 space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Pianifica orario di pubblicazione
            </label>
            <p className="text-xs text-gray-500">
              Lascia vuoto per pubblicare immediatamente. Se impostato, l&apos;evento sarà visibile agli utenti solo a partire da questa data e ora.
            </p>
            <input
              type="datetime-local"
              value={formData.publish_at}
              onChange={(e) => setFormData(prev => ({ ...prev, publish_at: e.target.value }))}
              className="input w-full"
            />
            {formData.publish_at && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, publish_at: '' }))}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Rimuovi orario pianificato
              </button>
            )}
          </div>
        )}

        {/* Registration window */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">Finestra iscrizioni</h2>
            <p className="text-sm text-gray-500">
              Definisci da quando e fino a quando gli utenti possono iscriversi. Lascia vuoti i campi per non applicare limiti.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apertura iscrizioni
              </label>
              <input
                type="datetime-local"
                value={formData.registrations_open_at}
                onChange={(e) => setFormData(prev => ({ ...prev, registrations_open_at: e.target.value }))}
                className="input w-full"
              />
              {formData.registrations_open_at && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, registrations_open_at: '' }))}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  Rimuovi
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chiusura iscrizioni
              </label>
              <input
                type="datetime-local"
                value={formData.registrations_close_at}
                onChange={(e) => setFormData(prev => ({ ...prev, registrations_close_at: e.target.value }))}
                className="input w-full"
              />
              {formData.registrations_close_at && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, registrations_close_at: '' }))}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  Rimuovi
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Auto Enroll Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Iscrizione automatica</h2>
            <p className="text-sm text-gray-500">
              Iscrive automaticamente tutti gli utenti a questo evento. Quando attiva, il limite posti non viene applicato.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.auto_enroll_all}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                auto_enroll_all: e.target.checked,
                max_posti: e.target.checked ? Math.max(prev.max_posti, 9999) : (prev.max_posti >= 9999 ? 50 : prev.max_posti),
              }))}
              className="sr-only peer"
            />
            <div className="relative w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Check-in Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Abilita check-in</h2>
            <p className="text-sm text-gray-500">
              Gli utenti possono registrare la presenza 15 min prima dell&apos;evento
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.checkin_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, checkin_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="relative w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* User Upload Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Upload materiale utenti</h2>
            <p className="text-sm text-gray-500">
              Dopo il check-in, gli utenti possono caricare documenti o link
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.user_can_upload_assets}
              onChange={(e) => setFormData(prev => ({ ...prev, user_can_upload_assets: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="relative w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Visibilita
          </label>
          <select
            value={formData.visibility}
            onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as EventVisibility }))}
            className="input w-full"
          >
            <option value="public">Pubblico - Visibile a tutti i visitatori</option>
            <option value="registered">Riservato - Solo utenti registrati</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            {formData.visibility === 'public'
              ? 'L\'evento sara visibile anche ai visitatori non registrati'
              : 'L\'evento sara visibile solo agli utenti con un account'}
          </p>
        </div>
      </div>

      {/* Actions - Responsive, full width on mobile */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 active:scale-[0.98] transition-all min-h-[48px]"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 min-h-[48px]"
        >
          {isSaving ? 'Salvataggio...' : isEditing ? 'Salva Modifiche' : 'Crea Evento'}
        </button>
      </div>
    </form >
  );
}
