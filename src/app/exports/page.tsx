import * as React from 'react';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Layers,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { requestBackendExport } from '../../services/studioService';
import type { ExportArtifactType, ExportJob } from '../../types';
import { calculateFullCoverSpec } from '../../utils/kdpDimensions';
import { formatTimeRelative, generateId } from '../../utils/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/shared/EmptyState';

const ARTIFACT_CARDS: Array<{
  type: ExportArtifactType;
  format: ExportJob['format'];
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    type: 'interior_pdf',
    format: 'Interior PDF',
    title: 'Interior PDF',
    description: 'Exact KDP trim + bleed PDF built from editable interior pages.',
    icon: FileText,
  },
  {
    type: 'full_cover_pdf',
    format: 'Full Cover PDF',
    title: 'Full Cover PDF',
    description: 'Back + calculated spine + front wrap PDF with 300 DPI spec.',
    icon: Layers,
  },
  {
    type: 'metadata_json',
    format: 'Metadata JSON',
    title: 'Metadata JSON',
    description: 'Structured KDP trim, spine, SEO, and validation report payload.',
    icon: FileCode2,
  },
  {
    type: 'book_preview',
    format: 'Book Preview',
    title: 'Book Preview',
    description: 'Standalone HTML print-layout flip preview for editorial review.',
    icon: BookOpen,
  },
  {
    type: 'complete_zip',
    format: 'Complete ZIP Package',
    title: 'Complete ZIP Package',
    description: 'All-in-one archive bundling Interior PDF, Cover PDF, JSON & Preview.',
    icon: Archive,
  },
];

export default function ExportsPage() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const exportsList = useAppStore((s) => s.exports);
  const addExportJob = useAppStore((s) => s.addExportJob);
  const updateExportJob = useAppStore((s) => s.updateExportJob);
  const addActivity = useAppStore((s) => s.addActivity);

  const editorDocs = useEditorStore((s) => s.documents);
  const ensureDocument = useEditorStore((s) => s.ensureDocument);

  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const [busyTypes, setBusyTypes] = React.useState<Record<string, boolean>>({});
  const [expandedJobId, setExpandedJobId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (project && !editorDocs[project.id]) {
      ensureDocument(project.id, project.title, project.trimSize, project.pageCount);
    }
  }, [project, editorDocs, ensureDocument]);

  const doc = editorDocs[project.id];
  const settings = doc?.settings ?? {
    trimSize: project.trimSize,
    pageCount: project.pageCount,
    interiorType: 'Black & White' as const,
    bleed: true,
    margins: { top: 0.5, bottom: 0.5, inside: 0.625, outside: 0.5 },
    paperType: 'White Paper' as const,
  };
  const coverSpec = calculateFullCoverSpec({
    trimSize: settings.trimSize,
    pageCount: settings.pageCount,
    paperType: settings.paperType,
    interiorType: settings.interiorType,
    bleed: settings.bleed,
  });

  const handleGenerate = async (
    artifactType: ExportArtifactType,
    format: ExportJob['format']
  ) => {
    const tempId = generateId('exp_pending');
    setBusyTypes((prev) => ({ ...prev, [artifactType]: true }));

    // Insert job in "Generating" state — NEVER mark Completed until backend confirms!
    addExportJob({
      id: tempId,
      projectId: project.id,
      projectTitle: project.title,
      artifactType,
      format,
      fileName: 'Waiting for backend build...',
      trimSize: settings.trimSize,
      status: 'Generating',
      validationStatus: 'Pending',
      fileSize: '—',
      createdAt: new Date().toISOString(),
    });

    try {
      const confirmed = await requestBackendExport({
        projectId: project.id,
        projectTitle: project.title,
        author: project.author,
        subtitle: project.subtitle,
        artifactType,
        trimSize: settings.trimSize,
        settings,
        pages: doc?.pages ?? [],
        coverSpec: {
          fullWidthIn: coverSpec.fullWidthIn,
          fullHeightIn: coverSpec.fullHeightIn,
          spineWidthIn: coverSpec.spineWidthIn,
          bleedIn: coverSpec.bleedIn,
          fullWidthPx300: coverSpec.fullWidthPx300,
          fullHeightPx300: coverSpec.fullHeightPx300,
          spineTextAllowed: coverSpec.spineTextAllowed,
        },
      });

      // Only transition to Completed after backend HTTP 200 confirms file & validation
      updateExportJob(tempId, {
        fileName: confirmed.fileName,
        fileSize: confirmed.fileSizeLabel,
        status: confirmed.status,
        validationStatus: confirmed.validationStatus,
        validationChecks: confirmed.validationChecks,
        downloadUrl: confirmed.downloadUrl,
        createdAt: confirmed.createdAt,
      });

      addActivity({
        title: `Backend confirmed ${format}`,
        description: `${confirmed.fileName} (${confirmed.fileSizeLabel}) · Validation ${confirmed.validationStatus}.`,
        category: 'export',
        projectId: project.id,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Backend export failed.';
      updateExportJob(tempId, {
        fileName: `${format} (Failed)`,
        status: 'Failed',
        validationStatus: 'Failed',
        errorMessage: errMsg,
      });
    } finally {
      setBusyTypes((prev) => ({ ...prev, [artifactType]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Export Center
          </h1>
          <p className="text-sm text-secondary">
            Build backend-validated Amazon KDP print files and download packages. Exports remain in
            Generating state until the server confirms completion and preflight validation.
          </p>
        </div>

        <Select
          aria-label="Select book project for export"
          value={project.id}
          onChange={(e) => setActiveProjectId(e.target.value)}
          className="w-64"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </div>

      {/* Active Spec Strip */}
      <div className="rounded-xl border border-border-subtle bg-sidebar px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-tabular text-secondary">
        <span className="font-semibold text-foreground">{project.title}</span>
        <span aria-hidden="true">·</span>
        <span>Trim: {settings.trimSize}&quot;</span>
        <span aria-hidden="true">·</span>
        <span>Pages: {settings.pageCount}</span>
        <span aria-hidden="true">·</span>
        <span>Spine: {coverSpec.spineWidthIn}&quot;</span>
        <span aria-hidden="true">·</span>
        <span>
          Cover Wrap: {coverSpec.fullWidthIn}&quot; × {coverSpec.fullHeightIn}&quot;
        </span>
      </div>

      {/* 5 Export Generators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {ARTIFACT_CARDS.map((item) => {
          const Icon = item.icon;
          const isBusy = Boolean(busyTypes[item.type]);
          return (
            <Card key={item.type} className="p-4 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="h-9 w-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-secondary leading-relaxed">{item.description}</p>
              </div>
              <Button
                size="sm"
                variant={item.type === 'complete_zip' ? 'primary' : 'secondary'}
                className="w-full"
                disabled={isBusy}
                onClick={() => handleGenerate(item.type, item.format)}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Building...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Export Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Backend-Confirmed Export History</CardTitle>
          <CardDescription>
            Every file name, byte size, validation status, and download URL is populated only after
            backend completion confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exportsList.length === 0 ? (
            <EmptyState
              title="No exports generated yet"
              description="Choose any of the 5 KDP export artifacts above to trigger a server-validated build."
              actionLabel="Generate Complete ZIP Package"
              onAction={() => handleGenerate('complete_zip', 'Complete ZIP Package')}
              icon={<Archive className="h-5 w-5" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-xs text-muted">
                    <th className="py-2.5 pr-4 font-medium">File Name</th>
                    <th className="py-2.5 pr-4 font-medium">Artifact</th>
                    <th className="py-2.5 pr-4 font-medium text-right">File Size</th>
                    <th className="py-2.5 pr-4 font-medium">Export Status</th>
                    <th className="py-2.5 pr-4 font-medium">Validation Status</th>
                    <th className="py-2.5 text-right font-medium">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {exportsList.map((job) => (
                    <React.Fragment key={job.id}>
                      <tr className="hover:bg-surface-hover/50">
                        <td className="py-3 pr-4">
                          <p className="font-mono-tabular text-xs font-medium text-foreground">
                            {job.fileName}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {job.projectTitle} · {formatTimeRelative(job.createdAt)}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-xs text-secondary whitespace-nowrap">
                          {job.format}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-tabular text-xs text-foreground whitespace-nowrap">
                          {job.fileSize}
                        </td>
                        <td className="py-3 pr-4 text-xs whitespace-nowrap">
                          {job.status === 'Generating' && (
                            <span className="inline-flex items-center gap-1.5 text-accent">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Generating
                            </span>
                          )}
                          {job.status === 'Completed' && (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed
                            </span>
                          )}
                          {job.status === 'Failed' && (
                            <span className="inline-flex items-center gap-1.5 text-rose-400">
                              <XCircle className="h-3.5 w-3.5" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs whitespace-nowrap">
                          <button
                            type="button"
                            disabled={!job.validationChecks?.length}
                            onClick={() =>
                              setExpandedJobId((prev) => (prev === job.id ? null : job.id))
                            }
                            className="inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-default hover:underline"
                          >
                            {job.validationStatus === 'Passed' && (
                              <span className="text-teal font-medium">Passed (4/4)</span>
                            )}
                            {job.validationStatus === 'Warnings' && (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Warnings
                              </span>
                            )}
                            {job.validationStatus === 'Pending' && (
                              <span className="text-muted">Pending</span>
                            )}
                            {job.validationStatus === 'Failed' && (
                              <span className="text-rose-400">Failed</span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {job.status === 'Completed' && job.downloadUrl ? (
                            <a
                              href={job.downloadUrl}
                              download={job.fileName}
                              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          ) : (
                            <Button size="sm" variant="secondary" disabled>
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expandedJobId === job.id && job.validationChecks && (
                        <tr className="bg-sidebar/70">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                              {job.validationChecks.map((chk) => (
                                <div key={chk.label} className="flex items-start gap-2">
                                  {chk.passed ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-teal shrink-0 mt-0.5" />
                                  ) : (
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-medium text-foreground">{chk.label}</p>
                                    <p className="text-muted">{chk.detail}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {job.errorMessage && (
                        <tr className="bg-rose-500/5">
                          <td colSpan={6} className="px-4 py-2 text-xs text-rose-300">
                            {job.errorMessage}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
