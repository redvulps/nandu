import { DockerClient } from '../client.js';

export interface ContainerNetworkData {
  ip: string;
  gateway: string;
  mac: string;
  ports: string;
  isRunning: boolean;
}

export async function getNetworkData(
  dockerClient: DockerClient,
  containerId: string
): Promise<ContainerNetworkData> {
  const info = await dockerClient.inspectContainer(containerId, true);
  const isRunning = info.State.Running;

  if (!isRunning) {
    return {
      ip: '',
      gateway: '',
      mac: '',
      ports: '',
      isRunning: false,
    };
  }

  // Basic network info - usually bridge
  const networks = info.NetworkSettings.Networks;
  const networkNames = Object.keys(networks);
  let ip = '';
  let gateway = '';
  let mac = '';

  if (networkNames.length > 0) {
    const net = networks[networkNames[0]];
    ip = net.IPAddress;
    gateway = net.Gateway;
    mac = net.MacAddress;
  }

  // Ports
  const ports = info.NetworkSettings.Ports;
  const portList: string[] = [];
  for (const [port, bindings] of Object.entries(ports)) {
    if (bindings) {
      for (const binding of bindings) {
        portList.push(`${binding.HostPort}:${port}`);
      }
    } else {
      portList.push(port);
    }
  }

  return {
    ip,
    gateway,
    mac,
    ports: portList.length > 0 ? portList.join(', ') : 'No ports forwarded',
    isRunning: true,
  };
}
