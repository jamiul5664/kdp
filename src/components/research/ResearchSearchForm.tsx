import * as React from 'react';
import { Search } from 'lucide-react';
import type { MarketplaceId, ResearchQueryParams } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Input';

interface ResearchSearchFormProps {
  initialValues: ResearchQueryParams;
  isLoading: boolean;
  onSubmit: (params: ResearchQueryParams) => void;
}

const CATEGORIES = [
  'All Categories',
  "Children's Books",
  'Coloring Books',
  'Activity Books',
  'Puzzle Books',
  'Journals',
  'Non-Fiction Guides',
  'Workbooks',
];

const AUDIENCES = [
  'All Audiences',
  'Kids Ages 4–8',
  'Kids Ages 8–12',
  'Teens & Young Adults',
  'Busy Adults',
  'Seniors 65+',
  'Parents & Educators',
];

const MARKETPLACES: Array<{ value: MarketplaceId; label: string }> = [
  { value: 'amazon.com', label: 'Amazon US (amazon.com)' },
  { value: 'amazon.co.uk', label: 'Amazon UK (amazon.co.uk)' },
  { value: 'amazon.de', label: 'Amazon DE (amazon.de)' },
  { value: 'amazon.ca', label: 'Amazon CA (amazon.ca)' },
  { value: 'amazon.com.au', label: 'Amazon AU (amazon.com.au)' },
];

export function ResearchSearchForm({
  initialValues,
  isLoading,
  onSubmit,
}: ResearchSearchFormProps) {
  const [query, setQuery] = React.useState(initialValues.query);
  const [category, setCategory] = React.useState(initialValues.category);
  const [targetAudience, setTargetAudience] = React.useState(initialValues.targetAudience);
  const [marketplace, setMarketplace] = React.useState<MarketplaceId>(initialValues.marketplace);
  const [dateRange, setDateRange] = React.useState<ResearchQueryParams['dateRange']>(
    initialValues.dateRange
  );

  React.useEffect(() => {
    if (initialValues.query) setQuery(initialValues.query);
  }, [initialValues.query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSubmit({ query: query.trim(), category, targetAudience, marketplace, dateRange });
  };

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a KDP topic or seed keyword (e.g., botanical coloring books, senior word search)..."
              className="pl-10"
              aria-label="Market research topic"
              required
            />
          </div>
          <Button type="submit" disabled={isLoading || !query.trim()}>
            <Search className="h-4 w-4" />
            {isLoading ? 'Researching...' : 'Run Market Research'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label htmlFor="res-category" className="text-xs text-secondary">
              Book Category
            </label>
            <Select
              id="res-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="res-audience" className="text-xs text-secondary">
              Target Audience
            </label>
            <Select
              id="res-audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="res-marketplace" className="text-xs text-secondary">
              Marketplace
            </label>
            <Select
              id="res-marketplace"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as MarketplaceId)}
            >
              {MARKETPLACES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="res-date" className="text-xs text-secondary">
              Date Range
            </label>
            <Select
              id="res-date"
              value={dateRange}
              onChange={(e) =>
                setDateRange(e.target.value as ResearchQueryParams['dateRange'])
              }
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
            </Select>
          </div>
        </div>
      </form>
    </Card>
  );
}
