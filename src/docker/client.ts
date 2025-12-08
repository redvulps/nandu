import { DockerConnection, StreamHandle } from './connection.js';
import type {
  DockerContainer,
  DockerContainerInspect,
  ContainerData,
  ComposeInfo,
  DockerSystemDfResponse,
  DockerImage,
  DockerImageInspect,
  ImageData,
  DockerEvent,
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
      throw new Error(`Failed to list containers: ${String(error)}`);
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

      return JSON.parse(response) as DockerContainerInspect;
    } catch (error) {
      throw new Error(`Failed to inspect container ${id}: ${String(error)}`);
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
      throw new Error(`Failed to start container ${id}: ${String(error)}`);
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
      throw new Error(`Failed to stop container ${id}: ${String(error)}`);
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
      throw new Error(`Failed to restart container ${id}: ${String(error)}`);
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
      throw new Error(`Failed to remove container ${id}: ${String(error)}`);
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
      throw new Error(
        `Failed to get logs for container ${id}: ${String(error)}`
      );
    }
  }

  /**
   * Get system data usage (df)
   * @returns System data usage information including volumes
   */
  public async getSystemDataUsage(): Promise<DockerSystemDfResponse> {
    try {
      const response = await this.connection.request('GET', '/system/df');

      return JSON.parse(response) as DockerSystemDfResponse;
    } catch (error) {
      throw new Error(`Failed to get system data usage: ${String(error)}`);
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
      throw new Error(`Failed to list images: ${String(error)}`);
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
      throw new Error(`Failed to remove image ${id}: ${String(error)}`);
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

      return JSON.parse(response) as DockerImageInspect;
    } catch (error) {
      throw new Error(`Failed to inspect image ${id}: ${String(error)}`);
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

  /**
   * Stream container logs in real-time with follow=true.
   * Returns a StreamHandle for cancellation.
   */
  public async streamContainerLogs(
    id: string,
    callbacks: {
      onLine: (line: string, stream: 'stdout' | 'stderr') => void;
      onError?: (error: Error) => void;
      onClose?: () => void;
    },
    options: { tail?: number; since?: number } = {}
  ): Promise<StreamHandle> {
    const tail = options.tail ?? 100;
    const since = options.since ?? 0;
    const path = `/containers/${id}/logs?stdout=true&stderr=true&follow=true&tail=${tail}&since=${since}`;

    let buffer = new Uint8Array(0);

    return this.connection.requestStream('GET', path, {
      onData: (chunk) => {
        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + chunk.length);
        newBuffer.set(buffer);
        newBuffer.set(chunk, buffer.length);
        buffer = newBuffer;

        // Parse log frames
        this.parseStreamingLogFrames(buffer, callbacks.onLine, (remaining) => {
          buffer = remaining;
        });
      },
      onError: callbacks.onError,
      onClose: callbacks.onClose,
    });
  }

  /**
   * Parse Docker log frames from streaming buffer.
   * Calls onLine for each complete line, and onRemaining with leftover bytes.
   */
  private parseStreamingLogFrames(
    buffer: Uint8Array<ArrayBuffer>,
    onLine: (line: string, stream: 'stdout' | 'stderr') => void,
    onRemaining: (remaining: Uint8Array<ArrayBuffer>) => void
  ): void {
    const decoder = new TextDecoder();

    // Detect if this is multiplexed format (non-TTY) or raw text (TTY)
    // Multiplexed format starts with stream type 0, 1, or 2
    // Raw text starts with actual text characters (>= 10 for newline, or >= 32 for printable)
    const firstByte = buffer[0];
    const isMultiplexed = firstByte === 0 || firstByte === 1 || firstByte === 2;

    if (!isMultiplexed) {
      // Raw text mode (TTY container) - just split on newlines
      const text = decoder.decode(buffer);
      const lines = text.split('\n');

      // Last element might be incomplete, keep it in buffer
      const remaining = lines.pop() ?? '';

      for (const line of lines) {
        if (line) {
          onLine(line, 'stdout');
        }
      }

      // Return remaining as bytes
      onRemaining(
        new TextEncoder().encode(remaining) as Uint8Array<ArrayBuffer>
      );
      return;
    }

    // Multiplexed format (non-TTY container)
    let offset = 0;

    while (offset < buffer.length) {
      // Need at least 8 bytes for header
      if (offset + 8 > buffer.length) {
        break;
      }

      // Read header: [STREAM_TYPE][0 0 0][SIZE (4 bytes BE)]
      const streamType = buffer[offset]; // 0=stdin, 1=stdout, 2=stderr
      const size =
        (buffer[offset + 4] << 24) |
        (buffer[offset + 5] << 16) |
        (buffer[offset + 6] << 8) |
        buffer[offset + 7];

      // Sanity check - if size is unreasonably large, assume format detection failed
      if (size > 1000000) {
        // Fallback to raw text
        const text = decoder.decode(buffer.subarray(offset));
        const lines = text.split('\n');
        const remaining = lines.pop() ?? '';

        for (const line of lines) {
          if (line) {
            onLine(line, 'stdout');
          }
        }

        onRemaining(
          new TextEncoder().encode(remaining) as Uint8Array<ArrayBuffer>
        );
        return;
      }

      // Check if we have complete payload
      if (offset + 8 + size > buffer.length) {
        break;
      }

      // Extract and decode payload
      const payload = buffer.subarray(offset + 8, offset + 8 + size);
      const line = decoder.decode(payload).replace(/\s+$/g, '');
      const stream = streamType === 2 ? 'stderr' : 'stdout';

      if (line) {
        onLine(line, stream);
      }

      offset += 8 + size;
    }

    // Return remaining bytes
    onRemaining(buffer.subarray(offset));
  }

  /**
   * Stream Docker events in real-time.
   * Returns a StreamHandle for cancellation.
   */
  public async streamEvents(
    callbacks: {
      onEvent: (event: DockerEvent) => void;
      onError?: (error: Error) => void;
      onClose?: () => void;
    },
    filters?: Record<string, string[]>
  ): Promise<StreamHandle> {
    let path = '/events';

    if (filters) {
      const encodedFilters = encodeURIComponent(JSON.stringify(filters));
      path += `?filters=${encodedFilters}`;
    }

    let buffer = '';

    return this.connection.requestStream('GET', path, {
      onData: (chunk) => {
        buffer += new TextDecoder().decode(chunk);

        // Events are newline-delimited JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line) as DockerEvent;
              callbacks.onEvent(event);
            } catch {
              // Skip malformed JSON
            }
          }
        }
      },
      onError: callbacks.onError,
      onClose: callbacks.onClose,
    });
  }
}
