import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CalendarCheck,
  CircleCheck,
  Check,
  ClipboardCheck,
  Ellipsis,
  FileSpreadsheet,
  FileText,
  Folder,
  House,
  Keyboard,
  Mic,
  Package,
  Plus,
  ScanLine,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { tokens } from './tokens';

const icons = {
  home: House,
  package: Package,
  scan: ScanLine,
  check: CircleCheck,
  sliders: SlidersHorizontal,
  search: Search,
  'chevron-right': ChevronRight,
  back: ChevronLeft,
  close: X,
  mic: Mic,
  keyboard: Keyboard,
  file: FileText,
  plus: Plus,
  tick: Check,
  up: ChevronUp,
  down: ChevronDown,
  more: Ellipsis,
  folder: Folder,
  clipboard: ClipboardCheck,
  sheet: FileSpreadsheet,
  calendar: CalendarCheck,
  'no-results': SearchX,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 20,
  color = tokens.color.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const C = icons[name];
  return <C size={size} color={color} strokeWidth={1.6} />;
}
