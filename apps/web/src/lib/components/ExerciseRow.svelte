<script lang="ts">
type Props = {
  name: string;
  sets: number;
  reps: number;
  weight: string;
  icon: string;
  active?: boolean;
  done?: boolean;
};

const {
  name,
  sets,
  reps,
  weight,
  icon,
  active = false,
  done = false,
}: Props = $props();
</script>

<div
  style={`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-left: 3px solid ${active ? "var(--color-accent)" : done ? "rgba(252,211,77,0.4)" : "rgba(255,255,255,0.08)"};
    background: ${active ? "rgba(252,211,77,0.07)" : "rgba(255,255,255,0.03)"};
    border-radius: 0 8px 8px 0;
  `}
>
  <div
    style={`
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 16px;
      background: ${active ? "rgba(252,211,77,0.15)" : "rgba(255,255,255,0.06)"};
      ${active ? "border: 1px solid rgba(252,211,77,0.2);" : ""}
    `}
  >
    {icon}
  </div>
  <div style="flex: 1; min-width: 0;">
    <div
      style={`
        font-size: 13px;
        font-weight: var(--font-weight-display);
        letter-spacing: 0.8px;
        text-transform: uppercase;
        margin-bottom: 2px;
        color: ${active ? "var(--color-text-primary)" : "var(--color-text-secondary)"};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `}
    >
      {name}
    </div>
    <div
      style={`
        font-size: 11px;
        font-weight: 600;
        letter-spacing: var(--letter-spacing-caps);
        text-transform: uppercase;
        color: ${active ? "var(--color-accent)" : "var(--color-text-muted)"};
      `}
    >
      {sets} Sets · {reps} Reps · {weight}
    </div>
  </div>
</div>
