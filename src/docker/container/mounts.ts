import { DockerClient } from '../client.js';
import { formatBytes } from '../../utils/formatBytes.js';

export interface ContainerMount {
  source: string;
  destination: string;
  type: string;
  size?: string;
}

export async function fetchVolumeSizes(
  dockerClient: DockerClient,
  containerId: string
): Promise<Map<string, number>> {
  const volumeSizes = new Map<string, number>();

  const info = await dockerClient.inspectContainer(containerId, true);
  if (info.Mounts && info.Mounts.some((m) => m.Type === 'volume')) {
    try {
      const systemData = await dockerClient.getSystemDataUsage();
      if (systemData.Volumes) {
        for (const vol of systemData.Volumes) {
          if (vol.UsageData) {
            volumeSizes.set(vol.Name, vol.UsageData.Size);
          }
        }
      }
    } catch (e) {
      console.error(`Failed to fetch system data usage: ${String(e)}`);
    }
  }

  return volumeSizes;
}

export async function getMountsData(
  dockerClient: DockerClient,
  containerId: string
): Promise<ContainerMount[]> {
  const info = await dockerClient.inspectContainer(containerId, true);
  if (!info.Mounts || info.Mounts.length === 0) {
    return [];
  }

  const volumeSizes = await fetchVolumeSizes(dockerClient, containerId);

  return info.Mounts.map((mount) => {
    let sizeStr: string | undefined;

    if (mount.Type === 'volume' && mount.Name && volumeSizes.has(mount.Name)) {
      const size = volumeSizes.get(mount.Name) || 0;
      sizeStr = formatBytes(size);
    }

    return {
      source: mount.Source,
      destination: mount.Destination,
      type: mount.Type,
      size: sizeStr,
    };
  });
}
