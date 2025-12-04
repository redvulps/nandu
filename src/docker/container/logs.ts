import { DockerClient } from '../client.js';

export async function getContainerLogs(
  dockerClient: DockerClient,
  containerId: string
): Promise<string> {
  try {
    return await dockerClient.getContainerLogs(containerId);
  } catch (error) {
    console.error(`Failed to load logs: ${error}`);
    return `Failed to load logs: ${String(error)}`;
  }
}
