import { DockerClient } from '../client.js';
import type { StreamHandle } from '../connection.js';
import type { DockerEvent } from '../types.js';

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
