import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Check, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { fetchPatterns, createMas } from '../api'
import type { Pattern } from '../types'
import patternTranslationsZh from '../i18n/patterns_zh.json'

interface CreatePageProps {
  workDir: string
}

/** Get translated pattern name (Chinese) or fall back to the original English name */
function getPatternName(id: string, name: string, isZh: boolean): string {
  if (!isZh) return name
  const key = id as keyof typeof patternTranslationsZh
  return patternTranslationsZh[key] || name
}

/** Get translated pattern description */
function getPatternDesc(id: string, fallback: string, isZh: boolean): string {
  if (!isZh) return fallback
  const key = (id + '-desc') as keyof typeof patternTranslationsZh
  return patternTranslationsZh[key] || fallback
}

/** Collapsible section wrapper */
function Section({ title, required, defaultOpen = true, children }: {
  title: string; required?: boolean; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between text-lg font-semibold text-gray-800 hover:text-gray-900"
        onClick={() => setOpen(!open)}
      >
        <span>
          {title}
          {required && <span className="text-red-400 ml-1">*</span>}
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </Card>
  )
}

/** Styled label + field */
function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

/** Radio group for selecting one option from a list */
function RadioGroup<T extends string>({
  value, onChange, options,
}: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string; desc?: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 rounded-lg border text-sm transition-all ${
            value === opt.value
              ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Checkbox group for selecting multiple options */
function CheckboxGroup<T extends string>({
  values, onChange, options,
}: {
  values: Set<T>; onChange: (v: Set<T>) => void;
  options: { value: T; label: string; desc?: string }[]
}) {
  const toggle = (v: T) => {
    const next = new Set(values)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-1.5 ${
            values.has(opt.value)
              ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
          title={opt.desc}
        >
          {values.has(opt.value) && <Check className="w-3.5 h-3.5" />}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
const textareaClass = inputClass + " resize-y"

export default function CreatePage({ workDir }: CreatePageProps) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  // Step state
  const [step, setStep] = useState<'form' | 'patterns' | 'creating'>('form')

  // Form fields
  const [targetDir, setTargetDir] = useState(workDir)
  const [projectIdentifier, setProjectIdentifier] = useState('')
  const [blueprintLanguage, setBlueprintLanguage] = useState('中文')
  const [reportLanguage, setReportLanguage] = useState('中文')
  const [researchTopic, setResearchTopic] = useState('')
  const [initialIdeas, setInitialIdeas] = useState('')
  const [dataSources, setDataSources] = useState('')
  const [existingReferences, setExistingReferences] = useState('')
  const [analysisMethods, setAnalysisMethods] = useState(isZh ? '由 AI 建议' : 'to be suggested by AI')
  const [reportFormat, setReportFormat] = useState(isZh ? '研究报告' : 'Research Report')
  const [reportStructure, setReportStructure] = useState(isZh ? '由 AI 建议' : 'to be suggested by AI')
  const [deliverableFormats, setDeliverableFormats] = useState<Set<string>>(new Set(['markdown']))
  const [qualityLevel, setQualityLevel] = useState('standard')
  const [observabilityLevel, setObservabilityLevel] = useState('normal')
  const [patternOverrides, setPatternOverrides] = useState('')
  const [otherRequirements, setOtherRequirements] = useState('')

  // Pattern selection
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())

  // Creation state
  const [output, setOutput] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [createdMasPath, setCreatedMasPath] = useState<string | null>(null)

  // Validation errors
  const [errors, setErrors] = useState<Set<string>>(new Set())

  // Fetch patterns on mount
  useEffect(() => {
    fetchPatterns()
      .then(data => {
        setPatterns(data)
        setSelectedPatterns(new Set(
          data.filter(p => p.necessity === 'Required' || p.necessity === 'Recommended').map(p => p.id)
        ))
      })
      .catch(console.error)
  }, [])

  // Update defaults when language changes
  useEffect(() => {
    const suggested = isZh ? '由 AI 建议' : 'to be suggested by AI'
    if (analysisMethods === '由 AI 建议' || analysisMethods === 'to be suggested by AI') setAnalysisMethods(suggested)
    if (reportStructure === '由 AI 建议' || reportStructure === 'to be suggested by AI') setReportStructure(suggested)
    if (reportFormat === '研究报告' || reportFormat === 'Research Report') setReportFormat(isZh ? '研究报告' : 'Research Report')
  }, [isZh]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const newErrors = new Set<string>()
    if (!targetDir.trim()) newErrors.add('targetDir')
    if (!projectIdentifier.trim()) newErrors.add('projectIdentifier')
    if (!researchTopic.trim()) newErrors.add('researchTopic')
    setErrors(newErrors)
    return newErrors.size === 0
  }

  const handleNext = () => {
    if (validate()) setStep('patterns')
  }

  const handlePatternToggle = (patternId: string, pattern: Pattern) => {
    if (pattern.necessity === 'Required') return
    setSelectedPatterns(prev => {
      const next = new Set(prev)
      if (next.has(patternId)) next.delete(patternId)
      else next.add(patternId)
      return next
    })
  }

  const handleCreate = async () => {
    setStep('creating')
    setIsCreating(true)
    setOutput([])

    try {
      await createMas(
        targetDir,
        projectIdentifier,
        {
          blueprintLanguage,
          reportLanguage,
          projectIdentifier,
          researchTopic,
          initialIdeas,
          dataSources,
          existingReferences,
          analysisMethods,
          reportFormat,
          reportStructure,
          deliverableFormats: Array.from(deliverableFormats).join(', ') || 'Markdown',
          qualityLevel,
          observabilityLevel,
          patternOverrides: patternOverrides || (isZh ? '无' : 'None'),
          otherRequirements: otherRequirements || (isZh ? '无' : 'None'),
        },
        Array.from(selectedPatterns),
        i18n.language,
        (content) => setOutput(prev => [...prev, content]),
        (masPath) => {
          setIsCreating(false)
          setCreatedMasPath(masPath)
        },
        (error) => {
          setOutput(prev => [...prev, `Error: ${error}`])
          setIsCreating(false)
        },
      )
    } catch (error) {
      setOutput(prev => [...prev, `Error: ${error}`])
      setIsCreating(false)
    }
  }

  // Group patterns by category
  const groupedPatterns = patterns.reduce((acc, pattern) => {
    if (!acc[pattern.category]) acc[pattern.category] = []
    acc[pattern.category].push(pattern)
    return acc
  }, {} as Record<string, Pattern[]>)

  const categoryOrder = ['COR', 'STR', 'BHV', 'QUA']
  const categoryNames: Record<string, string> = isZh ? {
    COR: '核心（Core）',
    STR: '结构（Structure）',
    BHV: '行为（Behavior）',
    QUA: '质量（Quality）',
  } : {
    COR: 'Core',
    STR: 'Structure',
    BHV: 'Behavior',
    QUA: 'Quality',
  }
  const categoryColors: Record<string, string> = {
    COR: 'text-purple-700',
    STR: 'text-blue-700',
    BHV: 'text-green-700',
    QUA: 'text-orange-700'
  }

  const errClass = (field: string) => errors.has(field) ? 'border-red-300 ring-1 ring-red-300' : ''

  // ========== Step: Creating ==========
  if (step === 'creating') {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={t('create.creating')} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm text-gray-100 h-96 overflow-y-auto">
              {output.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))}
              {isCreating && (
                <div className="flex items-center gap-2 text-blue-400 mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('create.processing')}
                </div>
              )}
            </div>

            {!isCreating && createdMasPath && (
              <div className="mt-6 flex gap-4">
                <Button onClick={() => navigate(`/viewer?path=${encodeURIComponent(createdMasPath)}`)}>
                  {t('create.viewCreated')}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/')}>
                  {t('create.backToDashboard')}
                </Button>
              </div>
            )}

            {!isCreating && !createdMasPath && (
              <div className="mt-6">
                <Button variant="secondary" onClick={() => setStep('patterns')}>
                  {t('create.back')}
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ========== Step: Pattern Selection ==========
  if (step === 'patterns') {
    return (
      <div className="flex flex-col h-full">
        <PageHeader onBack={() => setStep('form')} title={t('create.selectPatterns')} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {categoryOrder.map(category => (
              groupedPatterns[category] && (
                <div key={category}>
                  <h2 className={`text-lg font-semibold mb-3 ${categoryColors[category]}`}>
                    {categoryNames[category]}
                  </h2>
                  <div className="space-y-2">
                    {groupedPatterns[category].map(pattern => {
                      const isRequired = pattern.necessity === 'Required'
                      const isSelected = selectedPatterns.has(pattern.id)
                      const name = getPatternName(pattern.id, pattern.name, isZh)
                      const desc = getPatternDesc(pattern.id, pattern.description, isZh)
                      return (
                        <Card
                          key={pattern.id}
                          noPadding
                          className={`p-3 transition-colors ${
                            isRequired ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                          } ${isSelected ? 'bg-blue-50 border-blue-300' : 'hover:border-gray-300'}`}
                          onClick={() => handlePatternToggle(pattern.id, pattern)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                              isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{pattern.id}</span>
                                <span className="text-gray-700 text-sm">{name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  isRequired ? 'bg-red-100 text-red-700' :
                                  pattern.necessity === 'Recommended' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {pattern.necessity}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{desc}</p>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            ))}

            <div className="flex gap-4 pt-4 border-t">
              <Button variant="success" onClick={handleCreate}>
                {t('create.createMas')}
              </Button>
              <Button variant="secondary" onClick={() => setStep('form')}>
                {t('create.back')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ========== Step: Form ==========
  return (
    <div className="flex flex-col h-full">
      <PageHeader onBack={() => navigate('/')} title={t('create.title')} />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Location */}
          <Section title={t('create.location')} required>
            <Field label={t('create.parentDir')} required>
              <div className="flex gap-2">
                <input type="text" value={targetDir} onChange={e => { setTargetDir(e.target.value); setErrors(prev => { const n = new Set(prev); n.delete('targetDir'); return n }) }} className={`${inputClass} ${errClass('targetDir')}`} />
                <Button
                  variant="secondary" size="icon" className="shrink-0"
                  onClick={() => {
                    if ('showDirectoryPicker' in window) {
                      (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker()
                        .then((handle) => setTargetDir(handle.name))
                        .catch(() => {/* cancelled */})
                    } else {
                      const p = prompt(t('create.parentDir') + ':')
                      if (p) setTargetDir(p)
                    }
                  }}
                >
                  <FolderOpen className="w-5 h-5" />
                </Button>
              </div>
            </Field>
            <Field label={t('create.masName')} required hint={isZh ? '用于目录命名的简短标识，例如：industry_assessment' : 'Short identifier for directory naming, e.g., industry_assessment'}>
              <input
                type="text" value={projectIdentifier} onChange={e => { setProjectIdentifier(e.target.value); setErrors(prev => { const n = new Set(prev); n.delete('projectIdentifier'); return n }) }}
                placeholder="industry_assessment" className={`${inputClass} ${errClass('projectIdentifier')}`}
              />
            </Field>
          </Section>

          {/* Language Settings */}
          <Section title={t('create.language')}>
            <Field label={t('create.blueprintLang')}>
              <RadioGroup
                value={blueprintLanguage} onChange={setBlueprintLanguage}
                options={[
                  { value: '中文', label: '中文' },
                  { value: 'English', label: 'English' },
                ]}
              />
            </Field>
            <Field label={t('create.reportLang')}>
              <RadioGroup
                value={reportLanguage} onChange={setReportLanguage}
                options={[
                  { value: '中文', label: '中文' },
                  { value: 'English', label: 'English' },
                ]}
              />
            </Field>
          </Section>

          {/* Research Project */}
          <Section title={t('create.research')} required>
            <Field label={t('create.topic')} required hint={isZh ? '你想研究什么问题？希望解答哪些核心问题？' : 'What problem do you want to research? What core questions do you want to answer?'}>
              <textarea value={researchTopic} onChange={e => { setResearchTopic(e.target.value); setErrors(prev => { const n = new Set(prev); n.delete('researchTopic'); return n }) }} rows={3} className={`${textareaClass} ${errClass('researchTopic')}`} />
            </Field>
            <Field label={t('create.ideas')} hint={isZh ? '你对该问题的现有认知、初步假设、研究方向等' : 'Your existing understanding, preliminary hypotheses, research directions...'}>
              <textarea value={initialIdeas} onChange={e => setInitialIdeas(e.target.value)} rows={3} className={textareaClass} />
            </Field>
          </Section>

          {/* Data Collection */}
          <Section title={t('create.dataCollection')}>
            <Field label={t('create.dataSources')} hint={isZh ? '公开的网络信息、学术文献、政策文件、API 接口等' : 'Public web info, academic literature, policy documents, APIs, etc.'}>
              <textarea value={dataSources} onChange={e => setDataSources(e.target.value)} rows={2} className={textareaClass} />
            </Field>
            <Field label={isZh ? '现有参考资料' : 'Existing Reference Materials'} hint={isZh ? '文件路径或 URL，每行一条' : 'File paths or URLs, one per line'}>
              <textarea
                value={existingReferences} onChange={e => setExistingReferences(e.target.value)}
                placeholder={isZh ? '/path/to/document.pdf\nhttps://example.com/article' : '/path/to/document.pdf\nhttps://example.com/article'}
                rows={3} className={textareaClass}
              />
            </Field>
          </Section>

          {/* Analysis Methods */}
          <Section title={isZh ? '分析方法' : 'Analysis Methods'}>
            <Field label={t('create.analysisMethods')} hint={isZh ? '你将使用哪些方法来分析数据？也可以填写"由 AI 建议"' : 'What methods will you use? You can also write "to be suggested by AI"'}>
              <textarea value={analysisMethods} onChange={e => setAnalysisMethods(e.target.value)} rows={2} className={textareaClass} />
            </Field>
          </Section>

          {/* Output Format */}
          <Section title={isZh ? '输出格式' : 'Output Format'}>
            <Field label={t('create.reportFormat')} hint={isZh ? '最终报告应采用什么形式？例如：学术论文、研究报告、分析摘要' : 'What form should the final report take?'}>
              <textarea value={reportFormat} onChange={e => setReportFormat(e.target.value)} rows={2} className={textareaClass} />
            </Field>
            <Field label={t('create.reportStructure')}>
              <textarea value={reportStructure} onChange={e => setReportStructure(e.target.value)} rows={2} className={textareaClass} />
            </Field>
            <Field label={isZh ? '交付文件格式' : 'Deliverable File Formats'} hint={isZh ? 'Markdown 始终生成；勾选 PDF/DOCX 会配置导出流水线；勾选 Wiki 会创建知识图谱' : 'Markdown always generated; PDF/DOCX sets up export pipeline; Wiki creates knowledge graph'}>
              <CheckboxGroup
                values={deliverableFormats} onChange={setDeliverableFormats}
                options={[
                  { value: 'markdown', label: 'Markdown' },
                  { value: 'pdf', label: 'PDF' },
                  { value: 'docx', label: 'DOCX' },
                  { value: 'wiki', label: 'Wiki' },
                ]}
              />
            </Field>
          </Section>

          {/* Pattern Selection */}
          <Section title={t('create.patternSelection')}>
            <Field label={t('create.qualityLevel')}>
              <RadioGroup
                value={qualityLevel} onChange={setQualityLevel}
                options={[
                  { value: 'simple', label: t('create.qualitySimple'), desc: isZh ? '仅采用必需的模式' : 'Only required patterns' },
                  { value: 'standard', label: t('create.qualityStandard'), desc: 'QUA-01 + BHV-05' },
                  { value: 'strict', label: t('create.qualityStrict'), desc: 'QUA-01 + QUA-02 + BHV-05' },
                ]}
              />
            </Field>
            <Field label={t('create.observability')}>
              <RadioGroup
                value={observabilityLevel} onChange={setObservabilityLevel}
                options={[
                  { value: 'none', label: 'none', desc: isZh ? '不产生执行日志' : 'No execution logs' },
                  { value: 'minimal', label: 'minimal', desc: isZh ? '只记录错误' : 'Errors only' },
                  { value: 'normal', label: 'normal', desc: isZh ? '错误 + 警告（默认）' : 'Errors + warnings (default)' },
                  { value: 'detailed', label: 'detailed', desc: isZh ? '记录全部' : 'Log everything' },
                ]}
              />
            </Field>
            <Field label={t('create.patternOverrides')} hint={isZh ? '如果有特殊需求请说明，否则填写"无"' : 'Explain special requirements, or write "None"'}>
              <textarea
                value={patternOverrides} onChange={e => setPatternOverrides(e.target.value)}
                placeholder={isZh ? '无' : 'None'} rows={2} className={textareaClass}
              />
            </Field>
          </Section>

          {/* Other Requirements */}
          <Section title={t('create.other')}>
            <Field label={t('create.otherPlaceholder')}>
              <textarea
                value={otherRequirements} onChange={e => setOtherRequirements(e.target.value)}
                placeholder={isZh ? '无' : 'None'} rows={3} className={textareaClass}
              />
            </Field>
          </Section>

          {/* Actions */}
          <div className="flex gap-4 pt-2 pb-4">
            <Button onClick={handleNext}>
              {t('create.next')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')}>
              {t('create.cancel')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
