import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { medicineSummary } from '@/domain/alerts';
import { expiryDate, formatExpiry } from '@/domain/expiry';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { pluralUnit } from '@/lib/format';
import { Card, EmptyState, ListRow, Screen, SectionHeader, Skeleton, StatusPill } from '@/ui';
import { CompanyChips } from '../components/CompanyChips';

const DAY = 86_400_000;

export function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories, medicines, batches, companies, loading } = useInventory();
  const shop = useShop();
  const today = useToday();
  const [company, setCompany] = useState<string | null>(null);
  const category = categories.find((c) => c.id === id);

  if (loading || !shop)
    return (
      <Screen back="Stock">
        <Skeleton />
      </Screen>
    );
  if (!category)
    return (
      <Screen back="Stock">
        <EmptyState title="Category not found" />
      </Screen>
    );

  const all = medicines
    .filter((m) => m.categoryId === id)
    .map((m) => ({ m, s: medicineSummary(m.id, batches, today, shop.alertDays) }));
  const units = all.reduce((n, r) => n + r.s.qty, 0);
  const checked =
    category.lastCheckedAt === null
      ? 'never checked'
      : (() => {
          const d = Math.floor((today.getTime() - category.lastCheckedAt) / DAY);
          return d <= 0 ? 'checked today' : `checked ${d} day${d === 1 ? '' : 's'} ago`;
        })();
  const name = (cid: string) => companies.find((c) => c.id === cid)?.name ?? '';
  const present = [...new Set(all.map((r) => r.m.companyId))]
    .map((cid) => ({ id: cid, name: name(cid) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = all.filter((r) => company === null || r.m.companyId === company);
  const needs = shown
    .filter((r) => r.s.worst && r.s.worst !== 'ok')
    .sort((a, b) => expiryDate(a.s.next!).getTime() - expiryDate(b.s.next!).getTime());
  const good = shown
    .filter((r) => !needs.includes(r))
    .sort((a, b) => Number(!a.s.next) - Number(!b.s.next));

  const row = (r: (typeof all)[number]) => {
    const { m, s } = r;
    const sub = s.next
      ? `${name(m.companyId)} · ${pluralUnit(m.unit, s.qty)}${s.batchCount > 1 ? ` · ${s.batchCount} batches` : ''}`
      : `${name(m.companyId)} · out of stock`;
    const label =
      s.worst === 'expired'
        ? `Expired ${expiryDate(s.next!).getDate()} ${formatExpiry(s.next!).slice(0, 3)}`
        : s.next && formatExpiry(s.next);
    return (
      <ListRow
        key={m.id}
        title={m.name}
        subtitle={sub}
        right={s.worst && label ? <StatusPill status={s.worst} label={label} /> : null}
        chevron
        onPress={() => router.push(`/medicine/${m.id}`)}
      />
    );
  };

  return (
    <Screen
      title={category.name}
      meta={`${all.length} medicines · ${units} units · ${checked}`}
      back="Stock"
    >
      <CompanyChips companies={present} selected={company} onSelect={setCompany} />
      {needs.length > 0 && (
        <>
          <SectionHeader title="Needs action" />
          <Card>{needs.map(row)}</Card>
        </>
      )}
      {good.length > 0 && (
        <>
          <SectionHeader title="All good" />
          <Card>{good.map(row)}</Card>
        </>
      )}
      {shown.length === 0 && <EmptyState title="No medicines yet" />}
    </Screen>
  );
}
