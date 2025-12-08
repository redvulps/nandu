/**
 * Type definitions for Docker API responses and data structures
 */

export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: DockerPort[];
  Labels: Record<string, string>;
  Mounts: DockerMount[];
}

export interface DockerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

export interface DockerMount {
  Type: string;
  Name?: string;
  Source: string;
  Destination: string;
  Mode: string;
  RW: boolean;
}

export interface DockerContainerInspect {
  Id: string;
  Created: string;
  Path: string;
  Args: string[];
  State: DockerContainerState;
  Image: string;
  Name: string;
  RestartCount: number;
  Config: DockerContainerConfig;
  NetworkSettings: DockerNetworkSettings;
  SizeRw?: number;
  SizeRootFs?: number;
  Mounts: DockerMount[];
}

export interface DockerContainerState {
  Status: string;
  Running: boolean;
  Paused: boolean;
  Restarting: boolean;
  OOMKilled: boolean;
  Dead: boolean;
  Pid: number;
  ExitCode: number;
  Error: string;
  StartedAt: string;
  FinishedAt: string;
}

export interface DockerContainerConfig {
  Hostname: string;
  Env: string[];
  Cmd: string[];
  Image: string;
  Labels: Record<string, string>;
  WorkingDir: string;
}

export interface DockerNetworkSettings {
  Networks: Record<string, DockerNetwork>;
  Ports: Record<string, DockerPortBinding[]>;
}

export interface DockerNetwork {
  NetworkID: string;
  EndpointID: string;
  Gateway: string;
  IPAddress: string;
  IPPrefixLen: number;
  MacAddress: string;
}

export interface DockerPortBinding {
  HostIp: string;
  HostPort: string;
}

/**
 * Compose project information extracted from container labels
 */
export interface ComposeInfo {
  project: string;
  service: string;
  workingDir?: string;
  configFiles?: string;
  containerNumber?: number;
}

/**
 * Processed container information for UI display
 */
export interface ContainerData {
  id: string;
  shortId: string;
  name: string;
  image: string;
  status: string;
  state: string;
  isRunning: boolean;
  isCompose: boolean;
  composeInfo?: ComposeInfo;
  created: number;
  ports: string[];
}

export interface DockerVolumeUsage {
  Name: string;
  UsageData: {
    Size: number;
    RefCount: number;
  };
}

export interface DockerSystemDfResponse {
  LayersSize: number;
  Images: unknown[];
  Containers: unknown[];
  Volumes: DockerVolumeUsage[];
  BuildCache: unknown[];
}

/**
 * Docker Image from API response
 */
export interface DockerImage {
  Id: string;
  ParentId: string;
  RepoTags: string[] | null;
  RepoDigests: string[] | null;
  Created: number;
  Size: number;
  SharedSize: number;
  VirtualSize: number;
  Labels: Record<string, string> | null;
  Containers: number;
}

/**
 * Processed image information for UI display
 */
export interface ImageData {
  id: string;
  shortId: string;
  name: string;
  tag: string;
  repoTags: string[];
  size: number;
  created: number;
  inUse: boolean;
  containerCount: number;
}

/**
 * Docker Image Inspect response from /images/{id}/json
 */
export interface DockerImageInspect {
  Id: string;
  RepoTags: string[] | null;
  RepoDigests: string[] | null;
  Parent: string;
  Comment: string;
  Created: string;
  Container: string;
  DockerVersion: string;
  Author: string;
  Architecture: string;
  Os: string;
  Size: number;
  VirtualSize: number;
  Config: {
    Hostname: string;
    Env: string[] | null;
    Cmd: string[] | null;
    Image: string;
    WorkingDir: string;
    Entrypoint: string[] | null;
    Labels: Record<string, string> | null;
    ExposedPorts?: Record<string, object> | null;
  };
  RootFS: {
    Type: string;
    Layers: string[];
  };
}

/**
 * Docker event from /events stream
 */
export interface DockerEvent {
  Type:
    | 'container'
    | 'image'
    | 'volume'
    | 'network'
    | 'daemon'
    | 'plugin'
    | 'node'
    | 'service'
    | 'secret'
    | 'config';
  Action: string;
  Actor: {
    ID: string;
    Attributes: Record<string, string>;
  };
  time: number;
  timeNano: number;
}
