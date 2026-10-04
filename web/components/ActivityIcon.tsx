import {
  BarbellIcon,
  BedIcon,
  FeatherIcon,
  FlagCheckeredIcon,
  GaugeIcon,
  LightningIcon,
  MountainsIcon,
  PersonSimpleRunIcon,
  PersonSimpleTaiChiIcon,
  RepeatIcon,
  TrendUpIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Session } from "@/lib/types";

// One icon per kind of session, so a week can be read at a glance.
const ICONS: Record<string, { icon: Icon; label: string }> = {
  rest: { icon: BedIcon, label: "Rest" },
  easy: { icon: PersonSimpleRunIcon, label: "Easy run" },
  recovery: { icon: FeatherIcon, label: "Recovery run" },
  long: { icon: MountainsIcon, label: "Long run" },
  hills: { icon: TrendUpIcon, label: "Hills" },
  intervals: { icon: LightningIcon, label: "Intervals" },
  tempo: { icon: GaugeIcon, label: "Tempo" },
  strength: { icon: BarbellIcon, label: "Strength" },
  mobility: { icon: PersonSimpleTaiChiIcon, label: "Mobility" },
  race: { icon: FlagCheckeredIcon, label: "Race" },
  backToBack: { icon: RepeatIcon, label: "Back-to-back run" },
};

export function activityKind(s: Pick<Session, "type" | "title">): string {
  if (s.type === "easy" && /back-to-back/i.test(s.title)) return "backToBack";
  return ICONS[s.type] ? s.type : "easy";
}

export function ActivityIcon({ session, size = 22 }: { session: Pick<Session, "type" | "title">; size?: number }) {
  const { icon: Glyph, label } = ICONS[activityKind(session)];
  return <Glyph size={size} weight="duotone" aria-label={label} role="img" />;
}
