import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.SocketClient.prototype, 'connect_async', 'connect_finish');
Gio._promisify(
  Gio.OutputStream.prototype,
  'write_bytes_async',
  'write_bytes_finish'
);

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
      throw new Error(`Docker API request failed: ${error}`);
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
      throw new Error(`Failed to read response: ${error}`);
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

  /**
   * Update the socket path
   */
  public setSocketPath(path: string): void {
    this.socketPath = path;
  }
}
