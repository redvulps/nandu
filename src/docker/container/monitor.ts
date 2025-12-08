import GLib from 'gi://GLib';
import { DockerClient } from '../client.js';
import type { StreamHandle } from '../connection.js';
import type { DockerEvent } from '../types.js';

export type StatusChangeCallback = (status: string) => void;

/**
 * Monitor a container until it reaches a stable state (running or stopped).
 * Uses polling - consider monitorContainerEvents() for real-time updates.
 */
export function monitorUntilStartedOrExited(
  dockerClient: DockerClient,
  containerId: string,
  onStatusChange?: StatusChangeCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    let initialStatus: string | null = null;

    // Poll every 500ms
    const intervalId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      // We need to handle the async operation inside the callback
      // Since GLib.timeout_add expects a boolean return synchronously
      void (async () => {
        try {
          // Don't need size for status check
          const info = await dockerClient.inspectContainer(containerId, false);
          const currentStatus = info.State.Status;

          if (initialStatus === null) {
            initialStatus = currentStatus;
          }

          if (onStatusChange) {
            onStatusChange(currentStatus);
          }

          // Check if state has changed to something interesting
          // If it was restarting/created and now running
          // Or if it was running and now exited/stopped/dead

          const isRunning = currentStatus === 'running';
          const isStopped = ['exited', 'stopped', 'dead', 'paused'].includes(
            currentStatus
          );

          if (isRunning || isStopped) {
            // If we just started monitoring and it's already in a stable state,
            // we might want to wait for a CHANGE if that was the intent.
            // But the requirement is "until started or exited".
            // If it's already started, we resolve.

            // However, usually we start monitoring AFTER triggering an action.
            // So if we trigger START, it might be "created" or "restarting" initially.
            // If we trigger STOP, it might be "running" initially.

            // To be safe and simple: we resolve on ANY stable state (running or stopped).
            // The caller is responsible for knowing what they are waiting for,
            // or we just resolve when it settles.

            // Let's assume we want to resolve when it hits a "stable" state.
            // "restarting" is unstable. "removing" is unstable.

            if (
              currentStatus !== 'restarting' &&
              currentStatus !== 'removing'
            ) {
              GLib.Source.remove(intervalId);
              resolve(currentStatus);
            }
          }
        } catch (error) {
          GLib.Source.remove(intervalId);
          reject(error as Error);
        }
      })();

      return GLib.SOURCE_CONTINUE;
    });
  });
}

/**
 * Real-time container monitoring using Docker Events API.
 * Returns a StreamHandle for cancellation.
 */
export async function monitorContainerEvents(
  dockerClient: DockerClient,
  containerId: string,
  onStateChange: (state: string, event: DockerEvent) => void,
  onError?: (error: Error) => void
): Promise<StreamHandle> {
  return dockerClient.streamEvents(
    {
      onEvent: (event) => {
        // Filter for this container's events
        if (event.Actor.ID.startsWith(containerId)) {
          // Extract state from action (e.g., "start", "stop", "die")
          const state = event.Action;
          onStateChange(state, event);
        }
      },
      onError,
    },
    {
      container: [containerId],
      type: ['container'],
    }
  );
}
