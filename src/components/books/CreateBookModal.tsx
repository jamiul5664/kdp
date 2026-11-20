import * as React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import type { BookCategory, TrimSizeId } from '../../types';
import { TRIM_SIZES } from '../../utils/kdpDimensions';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';

const CATEGORIES: BookCategory[] = [
  'Coloring Books',
  "Children's Books",
  'Activity Books',
  'Puzzle Books',
  'Journals',
  'Non-Fiction Guides',
  'Workbooks',
];

export function CreateBookModal() {
  const open = useAppStore((s) => s.createModalOpen);
  const setOpen = useAppStore((s) => s.setCreateModalOpen);
  const createProject = useAppStore((s) => s.createProject);
  const setRoute = useAppStore((s) => s.setRoute);
  const ensureDocument = useEditorStore((s) => s.ensureDocument);

  const [title, setTitle] = React.useState('');
  const [subtitle, setSubtitle] = React.useState('');
  const [category, setCategory] = React.useState<BookCategory>('Coloring Books');
  const [trimSize, setTrimSize] = React.useState<TrimSizeId>('8.5x11');
  const [pageCount, setPageCount] = React.useState(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const project = createProject({
      title,
      subtitle,
      category,
      trimSize,
      pageCount: Math.max(24, Number(pageCount) || 100),
    });
    ensureDocument(project.id, project.title, project.trimSize, project.pageCount);
    setTitle('');
    setSubtitle('');
    setOpen(false);
    setRoute('/editor');
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Create New Book Project"
      description="Configure initial Amazon KDP trim dimensions and open directly in the Book Editor."
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-book-form" disabled={!title.trim()}>
            Create & Open Editor
          </Button>
        </>
      }
    >
      <form id="create-book-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="book-title" className="text-xs font-medium text-secondary">
            Book Title
          </label>
          <Input
            id="book-title"
            placeholder="e.g., Woodland Botanicals Coloring Book"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="book-subtitle" className="text-xs font-medium text-secondary">
            Subtitle (Optional)
          </label>
          <Input
            id="book-subtitle"
            placeholder="e.g., 50 Relaxing Single-Sided Line Art Illustrations"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="book-category" className="text-xs font-medium text-secondary">
              Category
            </label>
            <Select
              id="book-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BookCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="book-pages" className="text-xs font-medium text-secondary">
              Target Page Count (min 24)
            </label>
            <Input
              id="book-pages"
              type="number"
              min={24}
              max={828}
              value={pageCount}
              onChange={(e) => setPageCount(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="book-trim" className="text-xs font-medium text-secondary">
            KDP Trim Size
          </label>
          <Select
            id="book-trim"
            value={trimSize}
            onChange={(e) => setTrimSize(e.target.value as TrimSizeId)}
          >
            {Object.values(TRIM_SIZES).map((spec) => (
              <option key={spec.id} value={spec.id}>
                {spec.label} — {spec.recommendedFor}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}
