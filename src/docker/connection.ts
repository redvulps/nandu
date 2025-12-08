import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.SocketClient.prototype, 'connect_async', 'connect_finish');
Gio._promisify(
  Gio.OutputStream.prototype,
  'write_bytes_async',
  'write_bytes_finish'
);
Gio._promisify(
  Gio.InputStream.prototype,
  'read_bytes_async',
  'read_bytes_finish'
);

/**
 * Handle for an active stream, allowing cancellation
 */
export interface StreamHandle {
  cancel: () => void;
  isCancelled: () => boolean;
}

/**
 * Callbacks for streaming responses
 */
export interface StreamCallbacks {
  onData: (data: Uint8Array) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

/**
 * DockerConnection handles low-level communication with the Docker daemon
 * via Unix socket. It implements HTTP over Unix socket for Docker API calls.
 */
export class DockerConnection {
  private socketPath: string;
  private socketClient: Gio.SocketClient;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
    this.socketClient = new Gio.SocketClient();
  }

  /**
   * Make an HTTP request to the Docker API
   * @param method HTTP method (GET, POST, DELETE, etc.)
   * @param path API endpoint path (e.g., "/containers/json")
   * @param body Optional request body for POST/PUT requests
   * @returns Response body as string
   */
  /**
   * Make an HTTP request to the Docker API and return raw binary body
   * @param method HTTP method (GET, POST, DELETE, etc.)
   * @param path API endpoint path (e.g., "/containers/json")
   * @param body Optional request body for POST/PUT requests
   * @returns Response body as Uint8Array
   */
  public async requestBinary(
    method: string,
    path: string,
    body?: string
  ): Promise<Uint8Array> {
    try {
      // Connect to Unix socket
      const address = Gio.UnixSocketAddress.new(this.socketPath);
      const connection = await this.socketClient.connect_async(address, null);

      const outputStream = connection.get_output_stream();
      const inputStream = connection.get_input_stream();

      // Build HTTP request
      const contentLength = body ? new TextEncoder().encode(body).length : 0;
      const request = [
        `${method} ${path} HTTP/1.1`,
        `Host: localhost`,
        `User-Agent: Nandu/0.1`,
        `Accept: application/json`,
        contentLength > 0 ? `Content-Type: application/json` : null,
        contentLength > 0 ? `Content-Length: ${contentLength}` : null,
        `Connection: close`,
        ``,
        body || '',
      ]
        .filter((line) => line !== null)
        .join('\r\n');

      // Send request
      const requestBytes = new TextEncoder().encode(request);
      await outputStream.write_bytes_async(
        new GLib.Bytes(requestBytes),
        GLib.PRIORITY_DEFAULT,
        null
      );

      // Read response
      const responseData = await this.readResponse(inputStream);

      // Close connection
      connection.close(null);

      return responseData;
    } catch (error) {
      throw new Error(`Docker API request failed: ${String(error)}`);
    }
  }

  /**
   * Make an HTTP request to the Docker API and return string body
   */
  public async request(
    method: string,
    path: string,
    body?: string
  ): Promise<string> {
    const bytes = await this.requestBinary(method, path, body);
    return new TextDecoder().decode(bytes);
  }

  /**
   * Read HTTP response from input stream
   */
  private async readResponse(
    inputStream: Gio.InputStream
  ): Promise<Uint8Array> {
    try {
      const chunks: Uint8Array[] = [];
      const CHUNK_SIZE = 4096;

      while (true) {
        // Read bytes from stream
        const bytes = inputStream.read_bytes(CHUNK_SIZE, null);

        if (bytes.get_size() === 0) {
          break;
        }

        // Convert GLib.Bytes to Uint8Array
        const data = bytes.get_data();
        if (data) {
          chunks.push(new Uint8Array(data));
        }
      }

      // Combine all chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const fullResponse = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fullResponse.set(chunk, offset);
        offset += chunk.length;
      }

      return this.parseHttpResponseBytes(fullResponse);
    } catch (error) {
      throw new Error(`Failed to read response: ${String(error)}`);
    }
  }

  /**
   * Parse HTTP response bytes and extract body
   */
  private parseHttpResponseBytes(response: Uint8Array): Uint8Array {
    // Find double CRLF (\r\n\r\n) which separates headers from body
    // \r = 13, \n = 10
    let splitIndex = -1;
    for (let i = 0; i < response.length - 3; i++) {
      if (
        response[i] === 13 &&
        response[i + 1] === 10 &&
        response[i + 2] === 13 &&
        response[i + 3] === 10
      ) {
        splitIndex = i;
        break;
      }
    }

    if (splitIndex === -1) {
      throw new Error('Invalid HTTP response: No header separator found');
    }

    const headerBytes = response.subarray(0, splitIndex);
    const bodyBytes = response.subarray(splitIndex + 4);

    const headers = new TextDecoder().decode(headerBytes);

    // Check status code
    const statusLine = headers.split('\r\n')[0];
    const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+)/);
    if (!statusMatch) {
      throw new Error('Invalid HTTP status line');
    }

    const statusCode = parseInt(statusMatch[1], 10);
    if (statusCode < 200 || statusCode >= 300) {
      const errorBody = new TextDecoder().decode(bodyBytes);
      throw new Error(`HTTP error ${statusCode}: ${errorBody}`);
    }

    // Handle chunked encoding
    if (headers.toLowerCase().includes('transfer-encoding: chunked')) {
      return this.decodeChunkedBytes(bodyBytes);
    }

    return bodyBytes;
  }

  /**
   * Decode chunked transfer encoding for binary data
   */
  private decodeChunkedBytes(data: Uint8Array): Uint8Array {
    const chunks: Uint8Array[] = [];
    let index = 0;

    while (index < data.length) {
      // Find end of chunk size line
      let lineEnd = -1;
      for (let i = index; i < data.length - 1; i++) {
        if (data[i] === 13 && data[i + 1] === 10) {
          lineEnd = i;
          break;
        }
      }

      if (lineEnd === -1) {
        break;
      }

      // Parse chunk size (hex)
      const sizeBytes = data.subarray(index, lineEnd);
      const sizeHex = new TextDecoder().decode(sizeBytes);
      const size = parseInt(sizeHex, 16);

      if (isNaN(size)) {
        throw new Error(`Invalid chunk size: ${sizeHex}`);
      }

      if (size === 0) {
        break;
      }

      // Move past size and CRLF
      const dataStart = lineEnd + 2;

      // Append data
      if (dataStart + size > data.length) {
        // Incomplete chunk, take what we have (or error out)
        chunks.push(data.subarray(dataStart));
        break;
      }

      chunks.push(data.subarray(dataStart, dataStart + size));

      // Move past data and trailing CRLF
      index = dataStart + size + 2;
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Test the connection to Docker daemon
   * @returns true if connection is successful
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.request('GET', '/_ping');
      return true;
    } catch {
      return false;
    }
  }

  public setSocketPath(path: string): void {
    this.socketPath = path;
  }

  /**
   * Make a streaming HTTP request to the Docker API.
   * The connection stays open and data is passed to callbacks as it arrives.
   * Use the returned StreamHandle to cancel the stream when done.
   */
  public async requestStream(
    method: string,
    path: string,
    callbacks: StreamCallbacks,
    body?: string
  ): Promise<StreamHandle> {
    const cancellable = new Gio.Cancellable();
    let isCancelled = false;

    try {
      const address = Gio.UnixSocketAddress.new(this.socketPath);
      const connection = await this.socketClient.connect_async(address, null);

      const outputStream = connection.get_output_stream();
      const inputStream = connection.get_input_stream();

      // Build HTTP request (keep-alive for streaming)
      const contentLength = body ? new TextEncoder().encode(body).length : 0;
      const request = [
        `${method} ${path} HTTP/1.1`,
        `Host: localhost`,
        `User-Agent: Nandu/0.1`,
        `Accept: application/json`,
        contentLength > 0 ? `Content-Type: application/json` : null,
        contentLength > 0 ? `Content-Length: ${contentLength}` : null,
        ``, // No Connection: close for streaming
        body || '',
      ]
        .filter((line) => line !== null)
        .join('\r\n');

      // Send request
      const requestBytes = new TextEncoder().encode(request);
      await outputStream.write_bytes_async(
        new GLib.Bytes(requestBytes),
        GLib.PRIORITY_DEFAULT,
        null
      );

      // Read and validate HTTP headers first
      const headerResult = this.readStreamHeaders(inputStream);
      if (!headerResult.success) {
        throw new Error(headerResult.error);
      }

      // Create decoder for chunked encoding if needed
      let processData: (data: Uint8Array) => void;
      if (headerResult.isChunked) {
        let chunkBuffer = new Uint8Array(0);

        processData = (data: Uint8Array) => {
          // Append to chunk buffer
          const newBuffer = new Uint8Array(chunkBuffer.length + data.length);
          newBuffer.set(chunkBuffer);
          newBuffer.set(data, chunkBuffer.length);
          chunkBuffer = newBuffer;

          // Process complete chunks
          chunkBuffer = this.processChunkedData(
            chunkBuffer,
            callbacks.onData
          ) as Uint8Array<ArrayBuffer>;
        };
      } else {
        processData = callbacks.onData;
      }

      // Process any data that came with the headers (initial log lines)
      if (headerResult.remainingData && headerResult.remainingData.length > 0) {
        processData(headerResult.remainingData);
      }

      // Start async reading loop with chunked decoding
      void this.readStreamLoop(
        inputStream,
        { ...callbacks, onData: processData },
        cancellable
      );

      return {
        cancel: () => {
          if (!isCancelled) {
            isCancelled = true;
            cancellable.cancel();
            try {
              connection.close(null);
            } catch {
              // Connection might already be closed
            }
            callbacks.onClose?.();
          }
        },
        isCancelled: () => isCancelled,
      };
    } catch (error) {
      callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      callbacks.onClose?.();
      throw error;
    }
  }

  /**
   * Read HTTP headers from a stream and validate status code
   */
  private readStreamHeaders(inputStream: Gio.InputStream): {
    success: boolean;
    error?: string;
    remainingData?: Uint8Array;
    isChunked?: boolean;
  } {
    const CHUNK_SIZE = 4096;
    const chunks: Uint8Array[] = [];

    // Read until we find the header terminator
    while (true) {
      const bytes = inputStream.read_bytes(CHUNK_SIZE, null);
      if (bytes.get_size() === 0) {
        return {
          success: false,
          error: 'Connection closed before headers received',
        };
      }

      const data = bytes.get_data();
      if (data) {
        chunks.push(new Uint8Array(data));
      }

      // Check if we have the header terminator
      const combined = this.combineChunks(chunks);
      const headerEnd = this.findHeaderEnd(combined);

      if (headerEnd !== -1) {
        const headerBytes = combined.subarray(0, headerEnd);
        const headers = new TextDecoder().decode(headerBytes);

        // Validate status code
        const statusLine = headers.split('\r\n')[0];
        const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+)/);
        if (!statusMatch) {
          return { success: false, error: 'Invalid HTTP status line' };
        }

        const statusCode = parseInt(statusMatch[1], 10);
        if (statusCode < 200 || statusCode >= 300) {
          return { success: false, error: `HTTP error ${statusCode}` };
        }

        // Check for chunked transfer encoding
        const isChunked = headers
          .toLowerCase()
          .includes('transfer-encoding: chunked');

        // Return any data that came after the headers
        const remainingData = combined.subarray(headerEnd + 4); // +4 for \r\n\r\n
        return { success: true, remainingData, isChunked };
      }
    }
  }

  /**
   * Async loop to read stream data and call callbacks.
   * Uses async I/O to avoid blocking the GLib main loop.
   */
  private async readStreamLoop(
    inputStream: Gio.InputStream,
    callbacks: StreamCallbacks,
    cancellable: Gio.Cancellable
  ): Promise<void> {
    const CHUNK_SIZE = 4096;

    try {
      while (!cancellable.is_cancelled()) {
        const bytes = await inputStream.read_bytes_async(
          CHUNK_SIZE,
          GLib.PRIORITY_DEFAULT,
          cancellable
        );

        if (bytes.get_size() === 0) {
          // Stream ended
          break;
        }

        const data = bytes.get_data();
        if (data) {
          callbacks.onData(new Uint8Array(data));
        }
      }
    } catch (error) {
      if (!cancellable.is_cancelled()) {
        callbacks.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    } finally {
      if (!cancellable.is_cancelled()) {
        callbacks.onClose?.();
      }
    }
  }

  /**
   * Process chunked transfer encoding data.
   * Returns remaining unprocessed bytes.
   */
  private processChunkedData(
    buffer: Uint8Array,
    onData: (data: Uint8Array) => void
  ): Uint8Array {
    const decoder = new TextDecoder();
    let offset = 0;

    while (offset < buffer.length) {
      // Find the end of the chunk size line (CRLF)
      let crlfPos = -1;
      for (let i = offset; i < buffer.length - 1; i++) {
        if (buffer[i] === 0x0d && buffer[i + 1] === 0x0a) {
          crlfPos = i;
          break;
        }
      }

      if (crlfPos === -1) {
        // Haven't received complete chunk size line yet
        break;
      }

      // Parse chunk size (hex)
      const sizeLine = decoder.decode(buffer.subarray(offset, crlfPos));
      const chunkSize = parseInt(sizeLine.trim(), 16);

      if (isNaN(chunkSize)) {
        // Invalid chunk size - might be corrupted, skip
        offset = crlfPos + 2;
        continue;
      }

      if (chunkSize === 0) {
        // End of chunked data
        offset = buffer.length;
        break;
      }

      // Check if we have the complete chunk data (size + \r\n + data + \r\n)
      const dataStart = crlfPos + 2;
      const dataEnd = dataStart + chunkSize;

      if (dataEnd + 2 > buffer.length) {
        // Haven't received complete chunk yet
        break;
      }

      // Extract chunk data and pass to callback
      const chunkData = buffer.subarray(dataStart, dataEnd);
      onData(new Uint8Array(chunkData));

      // Move past chunk data and trailing \r\n
      offset = dataEnd + 2;
    }

    // Return remaining unprocessed data
    return buffer.subarray(offset);
  }

  /**
   * Find the end of HTTP headers (double CRLF)
   */
  private findHeaderEnd(data: Uint8Array): number {
    for (let i = 0; i < data.length - 3; i++) {
      if (
        data[i] === 13 &&
        data[i + 1] === 10 &&
        data[i + 2] === 13 &&
        data[i + 3] === 10
      ) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Combine multiple Uint8Array chunks into one
   */
  private combineChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}
