import { useState } from 'react';
import { View } from 'react-native';
import { batchStatus, daysUntilExpiry, formatExpiry } from '@/domain/expiry';
import type { AlertDays, Batch, Bill, Unit } from '@/domain/types';
import { dayMonth, expiresIn, pluralUnit } from '@/lib/format';
import { Button, ButtonRow, Card, KeyValueRow, StatusPill, T, tokens } from '@/ui';
import { EditCountSheet } from './EditCountSheet';

export function BatchCard({
  batch,
  unit,
  bill,
  today,
  alertDays,
  onSold,
  onSetCount,
  onReturned,
}: {
  batch: Batch;
  unit: Unit;
  bill: Bill | undefined;
  today: Date;
  alertDays: AlertDays;
  onSold: () => Promise<void>;
  onSetCount: (qty: number) => Promise<void>;
  onReturned: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Runs an async action with the buttons disabled; the screen shows any failure as a toast.
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  const from = !batch.billId
    ? 'Added by hand'
    : bill
      ? `${bill.supplier} · #${bill.billNo} · ${dayMonth(bill.billDate)}`
      : '—';
  return (
    <Card>
      <View style={{ padding: tokens.space[4], gap: tokens.space[2] }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <T
            size={16}
            weight="medium"
          >{`Batch ${batch.batchNo} · ${pluralUnit(unit, batch.qty)}`}</T>
          <StatusPill
            status={batchStatus(batch.expiry, today, alertDays)}
            label={formatExpiry(batch.expiry)}
          />
        </View>
        <KeyValueRow label="From bill" value={from} />
        <KeyValueRow label="Expires" value={expiresIn(daysUntilExpiry(batch.expiry, today))} />
        {confirming ? (
          <>
            <T size={14}>{`Mark batch ${batch.batchNo} as returned?`}</T>
            <ButtonRow>
              <Button label="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
              <Button
                label="Mark returned"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await onReturned();
                    setConfirming(false);
                  })
                }
              />
            </ButtonRow>
          </>
        ) : (
          <ButtonRow>
            <Button
              label="Sold 1"
              variant="secondary"
              disabled={busy}
              onPress={() => run(onSold)}
            />
            <Button label="Edit count" variant="secondary" onPress={() => setEditing(true)} />
            <Button label="Returned" variant="secondary" onPress={() => setConfirming(true)} />
          </ButtonRow>
        )}
      </View>
      {editing && (
        <EditCountSheet
          batchNo={batch.batchNo}
          qty={batch.qty}
          onClose={() => setEditing(false)}
          onSave={(q) => {
            setEditing(false);
            void run(() => onSetCount(q));
          }}
        />
      )}
    </Card>
  );
}
