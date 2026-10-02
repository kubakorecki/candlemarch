// Small pieces of the Vellum look shared by the HUD panels. Styles live in hud.css; see
// docs/agents/design-system.md for when to use which.
import { type BuildingDef, content, type JobId, type ResourceId } from '@candlemarch/content';
import { isStockpileGood } from '@candlemarch/sim';
import type { ReactNode } from 'react';
import { hex } from '../render/palette';
import { JOB_COLORS } from '../render/villagerArt';
import { Icon, type IconName } from './icons';

export type Tone = 'dire' | 'warn' | 'muted';

/** Goods a Stockpile can hold, in content order; Food never goes on one. */
export const STOCKPILE_RESOURCES = (Object.keys(content.resources) as ResourceId[]).filter((r) =>
  isStockpileGood(content, r),
);

/** Who a building employs: "1 Woodcutter", or "" for nobody. */
export function employsText(def: BuildingDef): string {
  return def.employs.map((e) => `${e.count} ${content.jobs[e.job].name}`).join(', ');
}

/** Each resource's icon, wherever goods are shown. */
export const RESOURCE_ICONS: Record<ResourceId, IconName> = {
  logs: 'log',
  firewood: 'firewood',
  fish: 'fish',
  berries: 'berry',
  mushrooms: 'mushroom',
  meat: 'meat',
  hides: 'hide',
  stone: 'stone',
  clay: 'clay',
  iron_ore: 'ore',
  grain: 'grain',
  charcoal: 'charcoal',
  planks: 'planks',
  cut_stone: 'cutStone',
  bricks: 'bricks',
  smoked_fish: 'smokedFish',
  smoked_meat: 'smokedMeat',
  iron_bars: 'ironBars',
  ale: 'ale',
};

/** Tracked capitals with a hairline to the right, and an optional note after it. */
export function SectionHead({
  title,
  aside,
  tone,
  big = false,
  className,
}: {
  title: string;
  aside?: ReactNode;
  tone?: Tone | undefined;
  big?: boolean;
  className?: string;
}) {
  const classes = ['section-head', big && 'big', tone && `tone-${tone}`, className].filter(Boolean);
  return (
    <div className={classes.join(' ')}>
      <span className="caps">{title}</span>
      <span className="rule" />
      {aside !== undefined && <span className="muted">{aside}</span>}
    </div>
  );
}

/** A square icon button labelled for screen readers and with a tooltip. `on` lights it. */
export function IconButton({
  icon,
  label,
  onClick,
  on = false,
  disabled = false,
  size = 'normal',
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  on?: boolean;
  disabled?: boolean;
  size?: 'normal' | 'small' | 'bare';
}) {
  const classes = ['icon-btn', size !== 'normal' && size, on && 'on'].filter(Boolean);
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={label}
      aria-pressed={size === 'normal' ? on : undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={size === 'normal' ? 20 : size === 'small' ? 14 : 18} />
    </button>
  );
}

/** A panel's close button. */
export function CloseButton({ onClick }: { onClick: () => void }) {
  return <IconButton icon="close" label="Close" size="bare" onClick={onClick} />;
}

/** An icon in a round gilt frame: a building in the inspector and on build cards. */
export function Medallion({
  icon,
  size = 24,
  className,
  children,
}: {
  icon: IconName;
  size?: number;
  /** Extra classes, e.g. `hero-medallion`. */
  className?: string;
  /** Laid over the frame, e.g. a `.keycap`. */
  children?: ReactNode;
}) {
  return (
    <span className={className ? `medallion ${className}` : 'medallion'}>
      <Icon name={icon} size={size} />
      {children}
    </span>
  );
}

/** A villager's initial on its Job's colour. */
export function Avatar({
  name,
  job,
  big = false,
  master = false,
}: {
  name: string;
  job: JobId;
  big?: boolean;
  /** A Master: a gilt ring and their star at the corner. */
  master?: boolean;
}) {
  return (
    <span
      className={`avatar${big ? ' big' : ''}${master ? ' master' : ''}`}
      style={{ background: hex(JOB_COLORS[job]) }}
      aria-hidden="true"
    >
      {name.charAt(0)}
      {master && <Icon name="master" size={big ? 16 : 13} className="master-mark" />}
    </span>
  );
}

/** A boxed message: a bold title in the tone's colour and an optional line under it. */
export function Callout({
  tone,
  icon = tone === 'dire' ? 'dire' : 'warn',
  title,
  detail,
}: {
  tone: 'dire' | 'warn';
  icon?: IconName;
  title: string;
  detail?: string;
}) {
  return (
    <div className={`callout tone-${tone}`}>
      <Icon name={icon} size={18} />
      <div>
        <div className="callout-title">{title}</div>
        {detail && <div className="callout-detail">{detail}</div>}
      </div>
    </div>
  );
}

/** A status word on a villager, e.g. Homeless. */
export function Chip({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <span className={`chip tone-${tone}`}>
      <Icon name={icon} size={15} />
      {children}
    </span>
  );
}

/** Gilt corner diamonds; the parent must be positioned. */
export function Corners({ all = false }: { all?: boolean }) {
  return (
    <>
      <span className="corner tl" />
      <span className="corner tr" />
      {all && <span className="corner bl" />}
      {all && <span className="corner br" />}
    </>
  );
}
