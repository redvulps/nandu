import { DockerClient } from '../client.js';
import { formatDate } from '../../utils/formatDate.js';

export interface ContainerSummary {
  name: string;
  image: string;
  status: string;
  id: string;
  command: string;
  created: string;
}

export async function getSummaryData(
  dockerClient: DockerClient,
  containerId: string
): Promise<ContainerSummary> {
  const info = await dockerClient.inspectContainer(containerId, false);

  return {
    name: info.Name.substring(1),
    image: info.Config.Image,
    status: info.State.Status,
    id: info.Id.substring(0, 12),
    command: info.Config.Cmd ? info.Config.Cmd.join(' ') : '',
    created: formatDate(info.Created, true),
  };
}
