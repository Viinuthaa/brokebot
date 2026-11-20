interface ReplayScrubberBarProps {
  maxSeq: number;
  replaySeq: number | null;
  disabled: boolean;
  onScrub: (seq: number) => void;
  onExitReplay: () => void;
}

export function ReplayScrubberBar({
  maxSeq,
  replaySeq,
  disabled,
  onScrub,
  onExitReplay,
}: ReplayScrubberBarProps) {
  const isReplaying = replaySeq !== null;
  const activeSeq = replaySeq ?? maxSeq;

  return (
    <section
      className="panel"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        gap: '14px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.76rem' }}>
        <strong>EVENT LOG REPLAY</strong>
        <span
          style={{
            padding: '2px 6px',
            border: '1.5px solid var(--ink)',
            background: isReplaying ? 'var(--accent-orange)' : 'var(--bg-cream-alt)',
            color: isReplaying ? 'var(--bg-cream)' : 'var(--ink)',
            fontWeight: 700,
            fontSize: '0.68rem',
          }}
        >
          {isReplaying ? `HISTORICAL #${activeSeq}` : `LIVE HEAD #${maxSeq}`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>#0</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, maxSeq)}
          value={activeSeq}
          disabled={disabled || maxSeq === 0}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val >= maxSeq) {
              onExitReplay();
            } else {
              onScrub(val);
            }
          }}
          style={{
            flex: 1,
            accentColor: 'var(--accent-orange)',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>#{maxSeq}</span>
      </div>

      {isReplaying && (
        <button
          type="button"
          className="btn-brutal btn-orange"
          onClick={onExitReplay}
          style={{ fontSize: '0.72rem', padding: '5px 10px' }}
        >
          RETURN TO LIVE
        </button>
      )}
    </section>
  );
}