import { DockerClient } from '../client.js';
import type { StreamHandle } from '../connection.js';

/**
 * Get a snapshot of container logs (non-streaming).
 */
export async function getContainerLogs(
  dockerClient: DockerClient,
  containerId: string
): Promise<string> {
  try {
    return await dockerClient.getContainerLogs(containerId);
  } catch (error) {
    console.error(`Failed to load logs: ${String(error)}`);
    return `Failed to load logs: ${String(error)}`;
  }
}

/**
 * Stream container logs in real-time.
 * Returns a StreamHandle for cancellation.
 */
export async function streamContainerLogs(
  dockerClient: DockerClient,
  containerId: string,
  onLine: (line: string, stream: 'stdout' | 'stderr') => void,
  onError?: (error: Error) => void,
  onClose?: () => void
): Promise<StreamHandle> {
  return dockerClient.streamContainerLogs(
    containerId,
    { onLine, onError, onClose },
    { tail: 100 }
  );
}
