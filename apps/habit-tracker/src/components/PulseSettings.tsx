"use client";

/**
 * The Pulse connection toggle.
 *
 * Sharing with Pulse is opt-in and lives here in Habit, where the data
 * originates. Turning it off deletes the local mirror immediately and tells
 * Pulse's connector to read nothing, even if a stale mirror lingers.
 */

interface PulseSettingsProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function PulseSettings({ enabled, onChange }: PulseSettingsProps) {
  return (
    <section aria-labelledby="pulse-settings-title" className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="pulse-settings-title" className="text-sm font-semibold">
            Share habits with Pulse
          </h2>
          <p className="mt-1 text-xs text-ink3">
            {enabled
              ? "Habit check-ins are mirrored on this device for Pulse to read. Turn off to delete the mirror and stop the connection."
              : "Off. Pulse can read nothing until you turn this on — check-ins stay in Habit only."}
          </p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <span className="sr-only">Share habits with Pulse</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-bg after:transition-transform peer-checked:after:translate-x-5"
          />
        </label>
      </div>
    </section>
  );
}
