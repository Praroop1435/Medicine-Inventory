import type { Batch, Bill, Device, StockEvent, Unit } from '@/domain/types';
import { dayMonth, pluralUnit } from '@/lib/format';
import { Card, ListRow } from '@/ui';

function describe(e: StockEvent, unit: Unit, bill: Bill | undefined): string {
  const n = Math.abs(e.delta);
  switch (e.type) {
    case 'added':
      return bill
        ? `+${pluralUnit(unit, e.delta)} from bill #${bill.billNo}`
        : `+${pluralUnit(unit, e.delta)} added`;
    case 'sold':
      return `Sold ${pluralUnit(unit, n)}`;
    case 'returned':
      return `Returned ${pluralUnit(unit, n)}`;
    default:
      return e.delta === 0
        ? 'Count checked, no change'
        : `Count changed by ${e.delta > 0 ? '+' : '-'}${n}`;
  }
}

export function HistoryList({
  events,
  unit,
  batches,
  bills,
  devices,
}: {
  events: StockEvent[];
  unit: Unit;
  batches: Batch[];
  bills: Bill[];
  devices: Device[];
}) {
  return (
    <Card>
      {events.map((e) => {
        const billId = batches.find((b) => b.id === e.batchId)?.billId;
        const bill = bills.find((b) => b.id === billId);
        const who = devices.find((d) => d.id === e.deviceId)?.displayName ?? '';
        return (
          <ListRow
            key={e.id}
            title={describe(e, unit, bill)}
            subtitle={`${dayMonth(new Date(e.at))} · ${who}`}
          />
        );
      })}
    </Card>
  );
}
