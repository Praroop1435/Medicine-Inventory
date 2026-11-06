import { Pressable, View } from 'react-native';
import { draftIssues, type DraftBatch, type DraftField } from '@/domain/draft';
import { formatExpiry } from '@/domain/expiry';
import { Button, Card, RowStatus, T, TickButton, tokens } from '@/ui';

const NOUN: Record<DraftField, string> = {
  medicineName: 'name',
  companyName: 'company',
  batchNo: 'batch',
  expiry: 'expiry',
  qty: 'quantity',
  categoryId: 'folder',
  unit: 'unit',
};

export type RowState = 'fix' | 'check' | 'ok';
export const rowState = (d: DraftBatch): RowState =>
  draftIssues(d).length ? 'fix' : d.uncertain.length ? 'check' : 'ok';

/** A reviewed row, collapsed: what was read, where it stands, and one tap to confirm it. */
export function ReviewRow({
  draft: d,
  onOpen,
  onConfirm,
}: {
  draft: DraftBatch;
  onOpen: () => void;
  onConfirm: () => void;
}) {
  const state = rowState(d);
  const name = d.medicineName.trim() || 'Unnamed medicine';
  const issues = draftIssues(d);
  const why =
    state === 'fix'
      ? `Add ${issues.map((f) => NOUN[f]).join(', ')}`
      : state === 'check'
        ? `Check ${d.uncertain.map((f) => NOUN[f]).join(', ')}`
        : null;
  // Below the details: company and why on the left, the one action on the right.
  const action =
    state === 'fix' ? (
      <Button label="Fix" variant="secondary" onPress={onOpen} />
    ) : state === 'check' ? (
      <TickButton
        label="Looks right"
        doneLabel="Confirmed"
        done={false}
        accessibilityLabel={`Looks right, ${name}`}
        onPress={onConfirm}
      />
    ) : null;
  return (
    <View testID="review-row">
      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}`}
          onPress={onOpen}
          style={({ pressed }) => ({
            gap: tokens.space[1] / 2,
            paddingHorizontal: tokens.space[4],
            paddingTop: tokens.space[4],
            opacity: pressed ? tokens.opacity.pressed : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}>
            <T size={16} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
              {name}
            </T>
            {state === 'ok' ? <RowStatus /> : null}
          </View>
          <T size={14} numberOfLines={1}>
            {`Batch ${d.batchNo || '—'} · Exp ${d.expiry ? formatExpiry(d.expiry) : '—'} · Qty ${d.qty ?? '—'}`}
          </T>
        </Pressable>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.space[3],
            paddingLeft: tokens.space[4],
            paddingRight: tokens.space[3],
            paddingTop: tokens.space[1] / 2,
            paddingBottom: action ? tokens.space[3] : tokens.space[4],
          }}
        >
          {/* Part of the row's tap target; the row's own label already names it for TalkBack. */}
          <Pressable
            accessible={false}
            onPress={onOpen}
            style={{ flex: 1, gap: tokens.space[1] / 2 }}
          >
            {d.companyName ? (
              <T size={12} color={tokens.color.muted} numberOfLines={1}>
                {d.companyName}
              </T>
            ) : null}
            {why ? (
              <T
                size={12}
                color={state === 'fix' ? tokens.color.expired : tokens.color.soon}
                numberOfLines={2}
              >
                {why}
              </T>
            ) : null}
          </Pressable>
          {action}
        </View>
      </Card>
    </View>
  );
}
