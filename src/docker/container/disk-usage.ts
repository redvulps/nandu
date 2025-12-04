import { formatBytes } from '../../utils/formatBytes.js';
import { DockerClient } from '../client.js';
import { fetchVolumeSizes } from './mounts.js';

export interface ContainerDiskUsage {
  rw: string;
  rootFs: string;
  volumes: string;
  total: string;
}

export async function getDiskUsageData(
  client: DockerClient,
  containerId: string
): Promise<ContainerDiskUsage> {
  const info = await client.inspectContainer(containerId, true);
  const volumeSizes = await fetchVolumeSizes(client, containerId);
  const sizeRw = info.SizeRw || 0;
  const sizeRootFs = info.SizeRootFs || 0;

  let totalVolumeSize = 0;
  if (info.Mounts) {
    for (const mount of info.Mounts) {
      if (
        mount.Type === 'volume' &&
        mount.Name &&
        volumeSizes.has(mount.Name)
      ) {
        totalVolumeSize += volumeSizes.get(mount.Name) || 0;
      }
    }
  }

  return {
    rw: formatBytes(sizeRw),
    rootFs: formatBytes(sizeRootFs),
    volumes: formatBytes(totalVolumeSize),
    total: formatBytes(sizeRootFs + totalVolumeSize),
  };
}
