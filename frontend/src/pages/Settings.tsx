import { useState } from 'react';
import {
  Music,
  Mic2,
  Palette,
  Play,
  Library,
  Gauge,
  Info,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import type { LyricsMode, AnimationIntensity, UiDensity, PlayerView } from '../stores/settingsStore';

type Section = 'playback' | 'lyrics' | 'appearance' | 'player' | 'library' | 'performance' | 'about';

const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: 'playback', label: 'Playback', icon: Music },
  { id: 'lyrics', label: 'Lyrics', icon: Mic2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'player', label: 'Player', icon: Play },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'about', label: 'About', icon: Info },
];

export function Settings() {
  const [activeSection, setActiveSection] = useState<Section>('playback');

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="sticky top-0 z-10 border-b border-[var(--glass-border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="flex h-14 items-center px-6">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Section nav — sidebar */}
        <nav
          className="w-48 shrink-0 overflow-y-auto border-r border-[var(--glass-border)] p-2 hidden sm:block"
          aria-label="Settings sections"
        >
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`nav-item w-full ${activeSection === s.id ? 'active' : ''}`}
                >
                  <s.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile section tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 py-2 sm:hidden no-scrollbar border-b border-[var(--glass-border)]">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSection === s.id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--glass-fill)]'
              }`}
            >
              <s.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            {activeSection === 'playback' && <PlaybackSection />}
            {activeSection === 'lyrics' && <LyricsSection />}
            {activeSection === 'appearance' && <AppearanceSection />}
            {activeSection === 'player' && <PlayerSection />}
            {activeSection === 'library' && <LibrarySection />}
            {activeSection === 'performance' && <PerformanceSection />}
            {activeSection === 'about' && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable settings primitives                                       */
/* ------------------------------------------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 text-lg font-semibold tracking-tight">{children}</h2>;
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)] leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-right text-xs text-[var(--text-tertiary)] tabular-nums">
        {format ? format(value) : value}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-[var(--surface-2)] accent-[var(--accent)]"
      />
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-[var(--glass-border)]" />;
}

/* ------------------------------------------------------------------ */
/*  Sections                                                          */
/* ------------------------------------------------------------------ */

function PlaybackSection() {
  const { playback, updatePlayback } = useSettingsStore();

  return (
    <>
      <SectionTitle>Playback</SectionTitle>

      <SettingRow
        label="Crossfade"
        description="Smooth transition between tracks"
      >
        <Slider
          value={playback.crossfadeDuration}
          onChange={(v) => updatePlayback({ crossfadeDuration: v })}
          min={0}
          max={12}
          step={1}
          format={(v) => (v === 0 ? 'Off' : `${v}s`)}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Gapless playback"
        description="No silence between tracks on albums"
      >
        <Toggle
          checked={playback.gaplessPlayback}
          onChange={(v) => updatePlayback({ gaplessPlayback: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="ReplayGain"
        description="Normalize volume across tracks"
      >
        <Toggle
          checked={playback.replayGain}
          onChange={(v) => updatePlayback({ replayGain: v })}
        />
      </SettingRow>
    </>
  );
}

function LyricsSection() {
  const { lyrics, updateLyrics } = useSettingsStore();

  return (
    <>
      <SectionTitle>Lyrics</SectionTitle>

      <SettingRow label="Display mode" description="How synced lyrics are presented">
        <Select<LyricsMode>
          value={lyrics.mode}
          onChange={(v) => updateLyrics({ mode: v })}
          options={[
            { value: 'spicy', label: 'Spicy (Synced)' },
            { value: 'classic', label: 'Classic' },
            { value: 'karaoke', label: 'Karaoke' },
            { value: 'minimal', label: 'Minimal' },
          ]}
        />
      </SettingRow>

      <Divider />

      <SettingRow label="Auto-follow" description="Scroll with the current line">
        <Toggle
          checked={lyrics.autoFollow}
          onChange={(v) => updateLyrics({ autoFollow: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow label="Text size" description="Lyric text scale">
        <Slider
          value={lyrics.textSize}
          onChange={(v) => updateLyrics({ textSize: v })}
          min={0.75}
          max={1.5}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </SettingRow>

      <Divider />

      <SettingRow label="Animations" description="Lyric transition intensity">
        <Select<AnimationIntensity>
          value={lyrics.animationIntensity}
          onChange={(v) => updateLyrics({ animationIntensity: v })}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'reduced', label: 'Reduced' },
            { value: 'off', label: 'Off' },
          ]}
        />
      </SettingRow>
    </>
  );
}

function AppearanceSection() {
  const { appearance, updateAppearance } = useSettingsStore();

  return (
    <>
      <SectionTitle>Appearance</SectionTitle>

      <SettingRow
        label="Dynamic album colors"
        description="Extract palette from album artwork"
      >
        <Toggle
          checked={appearance.dynamicAlbumColors}
          onChange={(v) => updateAppearance({ dynamicAlbumColors: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Glass effects"
        description="Backdrop blur and glass surfaces"
      >
        <Toggle
          checked={appearance.glassEffects}
          onChange={(v) => updateAppearance({ glassEffects: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Artwork blur"
        description="Subtle blur behind artwork"
      >
        <Toggle
          checked={appearance.artworkBlur}
          onChange={(v) => updateAppearance({ artworkBlur: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow label="UI density" description="Spacing and sizing">
        <Select<UiDensity>
          value={appearance.uiDensity}
          onChange={(v) => updateAppearance({ uiDensity: v })}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious', label: 'Spacious' },
          ]}
        />
      </SettingRow>
    </>
  );
}

function PlayerSection() {
  const { player, updatePlayer } = useSettingsStore();

  return (
    <>
      <SectionTitle>Player</SectionTitle>

      <SettingRow
        label="Default view"
        description="What the full-screen player shows"
      >
        <Select<PlayerView>
          value={player.defaultView}
          onChange={(v) => updatePlayer({ defaultView: v })}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'always-lyrics', label: 'Always Lyrics' },
            { value: 'always-artwork', label: 'Always Artwork' },
          ]}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Show lyrics automatically"
        description="Open lyrics when a song with lyrics starts"
      >
        <Toggle
          checked={player.showLyricsAutomatically}
          onChange={(v) => updatePlayer({ showLyricsAutomatically: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Full-screen layout"
        description="How artwork and lyrics share space"
      >
        <Select
          value={player.fullScreenBehavior}
          onChange={(v) => updatePlayer({ fullScreenBehavior: v as 'artwork' | 'lyrics' | 'split' })}
          options={[
            { value: 'split', label: 'Split' },
            { value: 'artwork', label: 'Artwork' },
            { value: 'lyrics', label: 'Lyrics' },
          ]}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Queue behavior"
        description="When adding a track from a list"
      >
        <Select
          value={player.queueBehavior}
          onChange={(v) => updatePlayer({ queueBehavior: v as 'replace' | 'append' })}
          options={[
            { value: 'replace', label: 'Replace queue' },
            { value: 'append', label: 'Add to queue' },
          ]}
        />
      </SettingRow>
    </>
  );
}

function LibrarySection() {
  const { library, updateLibrary } = useSettingsStore();

  return (
    <>
      <SectionTitle>Library</SectionTitle>

      <SettingRow label="Default sort" description="Song list sort order">
        <Select
          value={library.defaultSort}
          onChange={(v) => updateLibrary({ defaultSort: v as 'title' | 'artist' | 'album' | 'recent' | 'added' })}
          options={[
            { value: 'recent', label: 'Recently played' },
            { value: 'title', label: 'Title' },
            { value: 'artist', label: 'Artist' },
            { value: 'album', label: 'Album' },
            { value: 'added', label: 'Date added' },
          ]}
        />
      </SettingRow>

      <Divider />

      <SettingRow label="Default view" description="Grid or list layout">
        <Select
          value={library.defaultView}
          onChange={(v) => updateLibrary({ defaultView: v as 'grid' | 'list' })}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
        />
      </SettingRow>
    </>
  );
}

function PerformanceSection() {
  const { performance: perf, updatePerformance } = useSettingsStore();

  return (
    <>
      <SectionTitle>Performance</SectionTitle>

      <SettingRow
        label="Reduce animations"
        description="Disable decorative motion"
      >
        <Toggle
          checked={perf.reduceAnimations}
          onChange={(v) => updatePerformance({ reduceAnimations: v })}
        />
      </SettingRow>

      <Divider />

      <SettingRow
        label="Reduce visual effects"
        description="Disable glass blur, shadows"
      >
        <Toggle
          checked={perf.reduceVisualEffects}
          onChange={(v) => updatePerformance({ reduceVisualEffects: v })}
        />
      </SettingRow>
    </>
  );
}

function AboutSection() {
  const resetAll = useSettingsStore((s) => s.resetAll);

  return (
    <>
      <SectionTitle>About</SectionTitle>

      <div className="space-y-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#ff6b6b] to-[#ff9f68] shadow-lg shadow-[var(--accent)]/20">
              <Music className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold">Sonora</p>
              <p className="text-xs text-[var(--text-tertiary)]">Version 0.40.2</p>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
          A personal music server and player. Connects to your self-hosted
          Subsonic-compatible backend and renders your library with a
          liquid-glass interface.
        </p>

        <Divider />

        <div>
          <p className="mb-2 text-sm font-medium">Reset all settings</p>
          <p className="mb-3 text-xs text-[var(--text-tertiary)]">
            Restore all settings to their default values.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all settings to defaults?')) {
                resetAll();
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}
