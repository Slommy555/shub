import { useState, type ReactNode } from 'react';
import {
  HEAT_LABELS,
  HEAT_OPACITY,
  formatRange,
  heatLevel,
  thisWeekRange,
} from '../../lib/workout';
import { MUSCLE_LABELS, type MuscleGroup } from '../../types/workout';

interface Props {
  counts: Record<string, number>;
}

const FILL = 'fill-gray-900 dark:fill-gray-100';
const STROKE = 'stroke-gray-400 dark:stroke-gray-500';
const BODY = 'fill-gray-100 dark:fill-gray-800';

// Whole figure is drawn on a 200×440 canvas, centered on x = 100. Bilateral
// shapes are authored once for the right half and mirrored across the centerline
// with transform="translate(200,0) scale(-1,1)".
const MIRROR = 'translate(200,0) scale(-1,1)';

/** Right-half body outline; filled (closes along the centerline) + mirrored. */
const SILHOUETTE_HALF =
  'M100 16 C112 16 122 27 123 43 C123 53 120 61 116 67 C115 71 115 75 118 79 ' +
  'C126 81 134 86 143 94 C153 98 162 104 165 114 C167 128 166 150 164 166 ' +
  'C167 190 169 212 169 230 C169 242 168 252 163 254 C158 255 154 250 153 244 ' +
  'C151 222 150 195 150 170 C149 150 146 128 138 112 C133 122 128 145 124 170 ' +
  'C123 186 126 199 133 207 C139 215 141 241 139 270 C138 290 135 301 131 317 ' +
  'C133 341 134 373 131 399 C130 409 129 417 132 423 C136 427 142 428 139 433 ' +
  'C132 436 115 436 110 433 C106 430 105 424 106 416 C108 396 111 372 110 348 ' +
  'C108 320 105 300 104 281 C103 269 102 259 100 250';

function Muscle({
  group,
  counts,
  onPick,
  active,
  mirror = false,
  children,
}: {
  group: MuscleGroup;
  counts: Record<string, number>;
  onPick: (m: MuscleGroup) => void;
  active: MuscleGroup | null;
  mirror?: boolean;
  children: ReactNode;
}) {
  const op = HEAT_OPACITY[heatLevel(counts[group] ?? 0)];
  return (
    <g
      className={`cursor-pointer ${FILL} ${STROKE}`}
      fillOpacity={op}
      strokeWidth={active === group ? 1.4 : 0.6}
      strokeOpacity={active === group ? 1 : 0.7}
      onClick={() => onPick(group)}
      onMouseEnter={() => onPick(group)}
    >
      {children}
      {mirror && <g transform={MIRROR}>{children}</g>}
    </g>
  );
}

function Body() {
  return (
    <g className={`${BODY} stroke-gray-500 dark:stroke-gray-400`} strokeWidth={1.1} strokeLinejoin="round">
      <path d={SILHOUETTE_HALF} />
      <path d={SILHOUETTE_HALF} transform={MIRROR} />
    </g>
  );
}

function FrontFigure({
  counts,
  onPick,
  active,
}: {
  counts: Record<string, number>;
  onPick: (m: MuscleGroup) => void;
  active: MuscleGroup | null;
}) {
  const p = { counts, onPick, active };
  return (
    <svg viewBox="0 0 200 440" className="mx-auto h-80">
      <defs>
        <clipPath id="bodyClipFront">
          <path d={SILHOUETTE_HALF} />
          <path d={SILHOUETTE_HALF} transform={MIRROR} />
        </clipPath>
      </defs>
      <Body />

      {/* All muscles are clipped to the silhouette so nothing escapes the outline. */}
      <g clipPath="url(#bodyClipFront)">
      {/* shoulders */}
      <Muscle group="front_delts" mirror {...p}>
        <path d="M143 116 C153 108 165 113 166 129 C160 138 149 137 142 127 C141 122 140 118 143 116 Z" />
      </Muscle>
      <Muscle group="side_delts" mirror {...p}>
        <path d="M164 115 C172 119 174 133 170 145 C166 141 161 131 161 123 Z" />
      </Muscle>

      {/* chest — pec split into three bands */}
      <Muscle group="upper_chest" mirror {...p}>
        <path d="M100 116 C118 113 138 116 151 125 C140 130 120 130 100 128 Z" />
      </Muscle>
      <Muscle group="mid_chest" mirror {...p}>
        <path d="M100 129 C120 130 140 130 150 138 C140 146 118 148 100 145 Z" />
      </Muscle>
      <Muscle group="lower_chest" mirror {...p}>
        <path d="M100 146 C116 147 134 145 148 139 C141 154 118 158 100 155 Z" />
      </Muscle>

      {/* arms */}
      <Muscle group="biceps" mirror {...p}>
        <path d="M146 122 C156 124 161 140 159 162 C157 174 148 174 146 162 C144 148 144 134 146 122 Z" />
      </Muscle>
      <Muscle group="brachialis" mirror {...p}>
        <path d="M146 162 C154 162 158 170 157 178 C152 180 146 176 145 170 Z" />
      </Muscle>
      <Muscle group="forearm_flexors" mirror {...p}>
        <path d="M148 178 C159 180 166 198 164 224 C161 234 151 234 149 222 C147 206 147 190 148 178 Z" />
      </Muscle>

      {/* core */}
      <Muscle group="serratus" mirror {...p}>
        <path d="M126 150 L137 152 L132 159 Z" />
        <path d="M124 159 L135 161 L130 167 Z" />
        <path d="M124 167 L133 169 L128 175 Z" />
      </Muscle>
      <Muscle group="obliques" mirror {...p}>
        <path d="M118 162 C126 165 130 183 128 203 C122 207 117 200 116 188 Z" />
      </Muscle>
      <Muscle group="upper_abs" {...p}>
        <rect x="102" y="164" width="15" height="13" rx="3" />
        <rect x="83" y="164" width="15" height="13" rx="3" />
        <rect x="102" y="179" width="15" height="13" rx="3" />
        <rect x="83" y="179" width="15" height="13" rx="3" />
      </Muscle>
      <Muscle group="lower_abs" {...p}>
        <rect x="102" y="194" width="15" height="12" rx="3" />
        <rect x="83" y="194" width="15" height="12" rx="3" />
        <path d="M85 208 L115 208 L100 240 Z" />
      </Muscle>

      {/* legs (front) */}
      <Muscle group="adductors" mirror {...p}>
        <path d="M100 252 C108 255 110 275 107 300 C103 302 100 286 99 268 Z" />
      </Muscle>
      <Muscle group="quads_rectus" mirror {...p}>
        <path d="M104 252 C112 254 114 285 110 320 C106 326 103 312 103 290 Z" />
      </Muscle>
      <Muscle group="quads_lateral" mirror {...p}>
        <path d="M114 256 C126 260 130 285 126 315 C120 322 116 305 115 282 Z" />
      </Muscle>
      <Muscle group="quads_medial" mirror {...p}>
        <path d="M105 295 C113 298 116 312 113 326 C108 330 104 320 103 308 Z" />
      </Muscle>
      <Muscle group="tibialis" mirror {...p}>
        <path d="M110 340 C120 343 124 372 121 404 C116 410 111 400 110 372 Z" />
      </Muscle>

      {/* definition lines */}
      <g
        className="pointer-events-none stroke-gray-400/60 dark:stroke-gray-600/60"
        fill="none"
        strokeWidth={0.5}
        strokeLinecap="round"
      >
        <path d="M78 118 Q100 112 122 118" />
        <path d="M100 118 V160" />
        <path d="M100 164 V240" />
        <path d="M84 179 H116 M84 193 H116 M84 207 H116" />
      </g>
      </g>
    </svg>
  );
}

function BackFigure({
  counts,
  onPick,
  active,
}: {
  counts: Record<string, number>;
  onPick: (m: MuscleGroup) => void;
  active: MuscleGroup | null;
}) {
  const p = { counts, onPick, active };
  return (
    <svg viewBox="0 0 200 440" className="mx-auto h-80">
      <defs>
        <clipPath id="bodyClipBack">
          <path d={SILHOUETTE_HALF} />
          <path d={SILHOUETTE_HALF} transform={MIRROR} />
        </clipPath>
      </defs>
      <Body />

      {/* All muscles are clipped to the silhouette so nothing escapes the outline. */}
      <g clipPath="url(#bodyClipBack)">
      {/* shoulders */}
      <Muscle group="rear_delts" mirror {...p}>
        <path d="M143 116 C153 108 165 113 166 129 C160 138 149 137 142 127 C141 122 140 118 143 116 Z" />
      </Muscle>
      <Muscle group="side_delts" mirror {...p}>
        <path d="M164 115 C172 119 174 133 170 145 C166 141 161 131 161 123 Z" />
      </Muscle>

      {/* trapezius — big diamond, split into three */}
      <Muscle group="traps_upper" mirror {...p}>
        <path d="M100 88 C114 90 128 98 140 110 C128 114 112 112 100 110 Z" />
      </Muscle>
      <Muscle group="traps_mid" mirror {...p}>
        <path d="M100 112 C116 114 130 120 138 130 C126 136 112 136 100 134 Z" />
      </Muscle>
      <Muscle group="traps_lower" mirror {...p}>
        <path d="M100 136 C112 138 122 146 126 160 C114 168 104 164 100 152 Z" />
      </Muscle>
      <Muscle group="rhomboids" mirror {...p}>
        <path d="M100 116 C110 117 116 124 116 134 L100 134 Z" />
      </Muscle>
      <Muscle group="teres" mirror {...p}>
        <path d="M130 120 C142 120 150 130 148 144 C138 148 130 142 128 130 Z" />
      </Muscle>

      {/* arms (back) */}
      <Muscle group="triceps_long" mirror {...p}>
        <path d="M146 122 C154 124 158 142 156 164 C153 174 147 172 146 160 Z" />
      </Muscle>
      <Muscle group="triceps_lateral" mirror {...p}>
        <path d="M156 126 C164 128 168 144 166 162 C162 168 158 160 156 150 Z" />
      </Muscle>
      <Muscle group="triceps_medial" mirror {...p}>
        <path d="M147 163 C155 163 159 171 158 179 C153 181 147 177 146 171 Z" />
      </Muscle>
      <Muscle group="forearm_extensors" mirror {...p}>
        <path d="M148 178 C159 180 166 198 164 224 C161 234 151 234 149 222 C147 206 147 190 148 178 Z" />
      </Muscle>

      {/* lats + erectors */}
      <Muscle group="lats" mirror {...p}>
        <path d="M140 132 C150 138 152 158 144 182 C132 200 112 202 102 196 C108 180 112 156 116 138 C124 134 132 132 140 132 Z" />
      </Muscle>
      <Muscle group="lower_back" mirror {...p}>
        <path d="M100 180 C106 181 108 196 107 212 C103 214 100 205 99 192 Z" />
      </Muscle>

      {/* legs (back) */}
      <Muscle group="glutes" mirror {...p}>
        <path d="M100 214 C118 214 138 222 140 240 C140 258 126 268 110 264 C103 256 100 240 100 226 Z" />
      </Muscle>
      <Muscle group="hamstrings" mirror {...p}>
        <path d="M104 270 C116 273 122 300 118 336 C112 344 106 330 104 304 Z" />
      </Muscle>
      <Muscle group="calves_gastroc" mirror {...p}>
        <path d="M108 350 C120 352 126 372 122 396 C116 402 110 392 108 372 Z" />
      </Muscle>
      <Muscle group="calves_soleus" mirror {...p}>
        <path d="M110 400 C118 402 122 414 119 426 C114 430 110 418 109 408 Z" />
      </Muscle>

      {/* definition lines */}
      <g
        className="pointer-events-none stroke-gray-400/60 dark:stroke-gray-600/60"
        fill="none"
        strokeWidth={0.5}
        strokeLinecap="round"
      >
        <path d="M100 88 V214" />
        <path d="M88 116 Q82 128 88 140 M112 116 Q118 128 112 140" />
        <path d="M100 216 V266" />
      </g>
      </g>
    </svg>
  );
}

export default function MuscleMap({ counts }: Props) {
  const [picked, setPicked] = useState<MuscleGroup | null>(null);
  const { start, end } = thisWeekRange();

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Muscle map</h2>
        <span className="text-xs text-gray-500">This week · {formatRange(start, end)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <figure>
          <FrontFigure counts={counts} onPick={setPicked} active={picked} />
          <figcaption className="text-center text-[11px] text-gray-400">Front</figcaption>
        </figure>
        <figure>
          <BackFigure counts={counts} onPick={setPicked} active={picked} />
          <figcaption className="text-center text-[11px] text-gray-400">Back</figcaption>
        </figure>
      </div>

      {/* tooltip */}
      <div className="mt-2 min-h-[1.5rem] text-center text-sm">
        {picked ? (
          <span>
            <span className="font-semibold">{MUSCLE_LABELS[picked]}</span>{' '}
            <span className="text-gray-500">· {counts[picked] ?? 0} sets this week</span>
          </span>
        ) : (
          <span className="text-gray-400">Tap a muscle to see its weekly sets</span>
        )}
      </div>

      {/* legend */}
      <div className="mt-1 flex items-center justify-center gap-3">
        {HEAT_LABELS.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1">
            <svg viewBox="0 0 12 12" className="h-3 w-3">
              <rect
                width="12"
                height="12"
                rx="2"
                className={level === 0 ? BODY : 'fill-gray-900 dark:fill-gray-100'}
                fillOpacity={level === 0 ? 1 : HEAT_OPACITY[level]}
              />
            </svg>
            <span className="text-[11px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
