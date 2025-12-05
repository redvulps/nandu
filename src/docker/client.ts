import { DockerConnection } from './connection.js';
import type {
  DockerContainer,
  DockerContainerInspect,
  ContainerData,
  ComposeInfo,
  DockerSystemDfResponse,
  DockerImage,
  DockerImageInspect,
  ImageData,
} from './types.js';
import { truncateId } from '../utils/truncateId.js';

/**
 * DockerClient provides high-level access to Docker API functionality.
 * It handles parsing responses and extracting useful information like
 * compose project detection.
 */
export class DockerClient {
  private connection: DockerConnection;

  constructor(socketPath: string) {
    this.connection = new DockerConnection(socketPath);
  }

  /**
   * List all containers (running and stopped)
   * @param all If true, include stopped containers
   * @returns Array of processed container data
   */
  public async listContainers(all = true): Promise<ContainerData[]> {
    try {
      const path = `/containers/json?all=${all ? 'true' : 'false'}`;
      const response = await this.connection.request('GET', path);

      const containers: DockerContainer[] = JSON.parse(response);
      return containers.map((container) => this.processContainer(container));
    } catch (error) {
      throw new Error(`Failed to list containers: ${error}`);
    }
  }

  /**
   * Inspect a specific container
   * @param id Container ID or name
   * @param size Whether to include size information (default: false)
   * @returns Detailed container information
   */
  public async inspectContainer(
    id: string,
    size = false
  ): Promise<DockerContainerInspect> {
    try {
      const response = await this.connection.request(
        'GET',
        `/containers/${id}/json?size=${size}`
      );
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to inspect container ${id}: ${error}`);
    }
  }

  /**
   * Start a container
   * @param id Container ID or name
   */
  public async startContainer(id: string): Promise<void> {
    try {
      await this.connection.request('POST', `/containers/${id}/start`);
    } catch (error) {
      throw new Error(`Failed to start container ${id}: ${error}`);
    }
  }

  /**
   * Stop a container
   * @param id Container ID or name
   */
  public async stopContainer(id: string): Promise<void> {
    try {
      await this.connection.request('POST', `/containers/${id}/stop`);
    } catch (error) {
      throw new Error(`Failed to stop container ${id}: ${error}`);
    }
  }

  /**
   * Restart a container
   * @param id Container ID or name
   */
  public async restartContainer(id: string): Promise<void> {
    try {
      await this.connection.request('POST', `/containers/${id}/restart`);
    } catch (error) {
      throw new Error(`Failed to restart container ${id}: ${error}`);
    }
  }

  /**
   * Remove a container
   * @param id Container ID or name
   * @param force Force removal even if container is running
   */
  public async removeContainer(id: string, force = false): Promise<void> {
    try {
      const query = force ? '?force=true' : '';
      await this.connection.request('DELETE', `/containers/${id}${query}`);
    } catch (error) {
      throw new Error(`Failed to remove container ${id}: ${error}`);
    }
  }

  /**
   * Get container logs
   * @param id Container ID or name
   * @param tail Number of lines to show (default: 100)
   * @returns Log content as string
   */
  public async getContainerLogs(id: string, tail = 100): Promise<string> {
    try {
      const response = await this.connection.requestBinary(
        'GET',
        `/containers/${id}/logs?stdout=true&stderr=true&tail=${tail}`
      );
      return this.parseLogFrames(response);
    } catch (error) {
      throw new Error(`Failed to get logs for container ${id}: ${error}`);
    }
  }

  /**
   * Get system data usage (df)
   * @returns System data usage information including volumes
   */
  public async getSystemDataUsage(): Promise<DockerSystemDfResponse> {
    try {
      const response = await this.connection.request('GET', '/system/df');
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to get system data usage: ${error}`);
    }
  }

  /**
   * List all Docker images
   * @returns Array of processed image data
   */
  public async listImages(): Promise<ImageData[]> {
    try {
      const response = await this.connection.request('GET', '/images/json');
      const images: DockerImage[] = JSON.parse(response);
      return images.map((image) => this.processImage(image));
    } catch (error) {
      throw new Error(`Failed to list images: ${error}`);
    }
  }

  /**
   * Remove an image
   * @param id Image ID or name
   * @param force Force removal even if image is in use
   */
  public async removeImage(id: string, force = false): Promise<void> {
    try {
      const query = force ? '?force=true' : '';
      await this.connection.request('DELETE', `/images/${id}${query}`);
    } catch (error) {
      throw new Error(`Failed to remove image ${id}: ${error}`);
    }
  }

  /**
   * Inspect a specific image
   * @param id Image ID or name
   * @returns Detailed image information
   */
  public async inspectImage(id: string): Promise<DockerImageInspect> {
    try {
      const response = await this.connection.request(
        'GET',
        `/images/${id}/json`
      );
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to inspect image ${id}: ${error}`);
    }
  }

  /**
   * Process raw image data into UI-friendly format
   */
  private processImage(image: DockerImage): ImageData {
    const repoTags = image.RepoTags ?? [];
    const firstTag = repoTags[0] ?? '<none>:<none>';
    const [name, tag] = this.parseRepoTag(firstTag);

    return {
      id: image.Id,
      shortId: truncateId(image.Id),
      name,
      tag,
      repoTags,
      size: image.Size,
      created: image.Created,
      inUse: image.Containers > 0,
      containerCount: image.Containers,
    };
  }

  /**
   * Parse a repo:tag string into separate name and tag
   */
  private parseRepoTag(repoTag: string): [string, string] {
    if (repoTag === '<none>:<none>') {
      return ['<none>', '<none>'];
    }

    // Handle images with registry and port (e.g., localhost:5000/image:tag)
    const lastColon = repoTag.lastIndexOf(':');
    const lastSlash = repoTag.lastIndexOf('/');

    // If the colon is before the last slash, there's no tag (just registry:port)
    if (lastColon <= lastSlash) {
      return [repoTag, 'latest'];
    }

    return [repoTag.slice(0, lastColon), repoTag.slice(lastColon + 1)];
  }

  /**
   * Parse Docker log frames from binary response
   * Format: [STREAM_TYPE] [0 0 0] [SIZE] (8 bytes header) + [PAYLOAD]
   */
  private parseLogFrames(buffer: Uint8Array): string {
    let output = '';
    let offset = 0;
    const decoder = new TextDecoder();

    while (offset < buffer.length) {
      // Check if we have enough bytes for header (8 bytes)
      if (offset + 8 > buffer.length) {
        break;
      }

      // Read header
      // Byte 0: Stream type (1 = stdout, 2 = stderr)
      // Bytes 4-7: Payload size (Big Endian)
      const size =
        (buffer[offset + 4] << 24) |
        (buffer[offset + 5] << 16) |
        (buffer[offset + 6] << 8) |
        buffer[offset + 7];

      // Move past header
      offset += 8;

      // Check if we have enough bytes for payload
      if (offset + size > buffer.length) {
        // Incomplete frame, take what we can
        const payload = buffer.subarray(offset);
        output += decoder.decode(payload);
        break;
      }

      // Read payload
      const payload = buffer.subarray(offset, offset + size);
      output += decoder.decode(payload);

      // Move past payload
      offset += size;
    }

    return output;
  }

  /**
   * Test connection to Docker daemon
   * @returns true if connection is successful
   */
  public async ping(): Promise<boolean> {
    return this.connection.testConnection();
  }

  /**
   * Update the socket path
   */
  public setSocketPath(path: string): void {
    this.connection.setSocketPath(path);
  }

  /**
   * Process raw container data into UI-friendly format
   */
  private processContainer(container: DockerContainer): ContainerData {
    const name = this.extractContainerName(container.Names);
    const composeInfo = this.extractComposeInfo(container.Labels);

    return {
      id: container.Id,
      shortId: container.Id.substring(0, 12),
      name,
      image: container.Image,
      status: container.Status,
      state: container.State,
      isRunning: container.State === 'running',
      isCompose: composeInfo !== null,
      composeInfo: composeInfo || undefined,
      created: container.Created,
      ports: this.formatPorts(container.Ports),
    };
  }

  /**
   * Extract container name from Names array
   * Docker returns names with leading slash, we remove it
   */
  private extractContainerName(names: string[]): string {
    if (names.length === 0) {
      return 'unknown';
    }
    const name = names[0];
    return name.startsWith('/') ? name.substring(1) : name;
  }

  /**
   * Extract compose project information from container labels
   * @returns ComposeInfo if container is part of a compose project, null otherwise
   */
  private extractComposeInfo(
    labels: Record<string, string>
  ): ComposeInfo | null {
    const project = labels['com.docker.compose.project'];
    const service = labels['com.docker.compose.service'];

    if (!project || !service) {
      return null;
    }

    return {
      project,
      service,
      workingDir: labels['com.docker.compose.project.working_dir'],
      configFiles: labels['com.docker.compose.project.config_files'],
      containerNumber: labels['com.docker.compose.container-number']
        ? parseInt(labels['com.docker.compose.container-number'], 10)
        : undefined,
    };
  }

  /**
   * Format port mappings for display
   */
  private formatPorts(
    ports: Array<{
      IP?: string;
      PrivatePort: number;
      PublicPort?: number;
      Type: string;
    }>
  ): string[] {
    return ports.map((port) => {
      if (port.PublicPort) {
        return `${port.PublicPort}:${port.PrivatePort}/${port.Type}`;
      }
      return `${port.PrivatePort}/${port.Type}`;
    });
  }
}
