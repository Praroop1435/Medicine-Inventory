import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { medicineSummary } from '@/domain/alerts';
import { expiryDate, formatExpiry } from '@/domain/expiry';
import { childrenOf, pathLabel, rollupSummary } from '@/domain/tree';
import type { Category } from '@/domain/types';
import { CategoryList } from '@/features/home/components/CategoryList';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { daysSince, medicineCount, pluralUnit } from '@/lib/format';
import {
  Button,
  ButtonRow,
  Card,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  StatusPill,
  tokens,
} from '@/ui';
import { View } from 'react-native';
import { CategoryEditor } from '../components/CategoryEditor';
import { CompanyChips } from '../components/CompanyChips';
import { FolderMenu } from '../components/FolderMenu';

export function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FolderScreen id={id} />;
}

/** A folder (§11.1): its sub-folders, then its own medicines. `id` null is the Stock tab (top level). */
export function FolderScreen({ id }: { id: string | null }) {
  const { categories, medicines, batches, companies, loading } = useInventory();
  const shop = useShop();
  const today = useToday();
  const [company, setCompany] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuFor, setMenuFor] = useState<Category | null>(null);
  const category = categories.find((c) => c.id === id);
  const parent = categories.find((c) => c.id === category?.parentId);
  const back = id === null ? undefined : parent ? parent.name : 'Stock';

  if (loading || !shop)
    return (
      <Screen back={back}>
        <Skeleton />
      </Screen>
    );
  if (id !== null && !category)
    return (
      <Screen back={back}>
        <EmptyState
          icon="folder"
          title="Folder not found"
          body="It may have been deleted on another phone."
        />
      </Screen>
    );

  const folders = childrenOf(categories, id);
  const folderSection = (
    <>
      {folders.length > 0 && (
        <SectionHeader
          title={id === null ? 'Categories' : 'Folders'}
          right={folders.length > 1 ? (editing ? 'Done' : 'Edit order') : undefined}
          onRightPress={() => setEditing((e) => !e)}
        />
      )}
      <CategoryList parentId={id} editable={editing} onMenu={setMenuFor} />
      {menuFor && <FolderMenu folder={menuFor} onClose={() => setMenuFor(null)} />}
    </>
  );
  const newFolder = (
    <View style={{ paddingTop: tokens.space[4] }}>
      {adding ? (
        <Card>
          <View style={{ padding: tokens.space[4] }}>
            <CategoryEditor parentId={id} onDone={() => setAdding(false)} />
          </View>
        </Card>
      ) : (
        <ButtonRow>
          <Button label="+ New folder" variant="secondary" onPress={() => setAdding(true)} />
        </ButtonRow>
      )}
    </View>
  );
  if (id === null || !category)
    return (
      <Screen title="Stock">
        {folderSection}
        {newFolder}
      </Screen>
    );

  const all = medicines
    .filter((m) => m.categoryId === id)
    .map((m) => ({ m, s: medicineSummary(m.id, batches, today, shop.alertDays) }));
  const total = rollupSummary(categories, medicines, batches, category.id, today, shop.alertDays);
  const checked =
    category.lastCheckedAt === null
      ? 'never checked'
      : (() => {
          const d = daysSince(category.lastCheckedAt, today);
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
        onPress={() => router.push(`/medicine/${m.id}?from=folder`)}
      />
    );
  };

  return (
    <Screen
      title={pathLabel(categories, category.id)}
      meta={`${medicineCount(total.medicineCount)} · ${total.unitCount} units · ${checked}`}
      back={back}
    >
      {folderSection}
      {all.length > 0 && (
        <View style={{ paddingTop: folders.length ? tokens.space[4] : 0 }}>
          <CompanyChips companies={present} selected={company} onSelect={setCompany} />
        </View>
      )}
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
      {all.length === 0 && folders.length === 0 && !adding ? (
        <EmptyState
          icon="folder"
          title={`Nothing in ${category.name} yet`}
          body="Add the medicines on this shelf, or split it into smaller folders."
        >
          <View style={{ gap: tokens.space[3] }}>
            <Button
              label="Add stock"
              full
              onPress={() => router.push(`/intake/manual?categoryId=${category.id}`)}
            />
            <Button label="New folder" variant="secondary" full onPress={() => setAdding(true)} />
          </View>
        </EmptyState>
      ) : (
        newFolder
      )}
    </Screen>
  );
}
