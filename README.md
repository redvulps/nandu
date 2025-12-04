# Nandu

A modern, open-source alternative to Docker Desktop for Linux, built with GTK4 and libadwaita.

![Nandu Logo](./data/icons/hicolor/scalable/apps/org.redvulps.nandu.svg)

## About the Name

Nandu is named in honor of **Nandu**, a male orca captured in Iceland in 1983 and brought to Brazil to perform at the Playcenter amusement park in São Paulo. Nandu lived a short and tragic life in captivity, passing away in 1988 at a young age due to health complications. His skeleton remains on display at the Museum of Veterinary Anatomy at the University of São Paulo (USP).

I've chosen this name to honor his memory and to remind us of the importance of freedom and proper care for all living beings. Just as the Docker logo features a whale, Nandu represents our commitment to treating our containerized environments—and the world around us—with respect.

For more information about Nandu's story, visit his [Wikipedia page](<https://pt.wikipedia.org/wiki/Nandu_(orca)>).

## What is Nandu?

Nandu is a native Linux application that provides a beautiful, intuitive interface for managing Docker containers. Unlike Docker Desktop, Nandu connects directly to your existing docker-ce installation, giving you full control over your Docker environment without additional overhead.

### Current Features

- **Container Overview**: View all running and stopped containers in a clean, organized interface
- **Docker Compose Support**: Automatically groups containers by compose project for easier management
- **Detailed Container Information**:
  - View comprehensive container details including summary, network configuration, and mounts
  - Monitor disk usage with detailed read/write statistics
  - Browse container logs with real-time updates
- **Container Management**: Start, stop, restart, and delete containers directly from the UI
- **Real-time State Monitoring**: Visual feedback with spinners during container state transitions
- **Search and Filter**: Quickly find containers using the built-in search functionality
- **Flexible Connection**: Choose between local socket or custom remote Docker host connection

### Key Features

- **Native Docker Integration**: Connects directly to docker-ce via Docker socket
- **Smart Container Detection**: Automatically differentiates between:
  - **Stray containers**: Standalone containers created manually
  - **Compose containers**: Containers managed by docker-compose projects
- **Connection Options**: On first run, choose between:
  - **Local**: Automatically connect to the default local Docker socket
  - **Custom**: Specify a custom socket path or remote Docker host
- **Native GNOME Experience**: Built with GTK4 and libadwaita for a seamless Linux desktop experience

## Current Status

🚧 **Active Development** - Nandu is functional and actively developed. Core container management features are implemented, including:

- Container listing and filtering
- Start/stop/restart operations
- Detailed container information viewing
- Docker Compose project grouping
- Container logs and monitoring

The UI/UX and additional features are being continuously refined.

## Development Workflows

Nandu supports two development approaches depending on your needs:

### Option 1: Native Development (Recommended for Quick Iteration)

For rapid local testing without Flatpak overhead, you only need system-level development tools.

**Prerequisites:**

- `meson` - Build system
- `ninja` - Build tool
- `gjs` - GNOME JavaScript runtime
- `glib-compile-schemas` - Schema compiler (part of glib development tools)
- `npm` - Node package manager

**Setup:**

```bash
npm install
```

This installs TypeScript, ESLint, Prettier, and other development dependencies.

**Build and Run:**

```bash
npm start
```

This script (`scripts/start.sh`) will:

- Check for required development tools
- Set up the meson build directory if needed
- Compile TypeScript code
- Compile GResources (UI files, icons, etc.)
- Compile GSettings schemas
- Run the application

If any tool is missing, the script will show installation instructions for your distribution.

---

### Option 2: Flatpak Development (For Testing Sandboxed Builds)

Use this approach to test the application in a sandboxed Flatpak environment, matching production deployment.

**Prerequisites:**

#### Flatpak Builder

Install Flatpak Builder:

DNF based distributions (Fedora, RHEL, etc.)

```bash
sudo dnf install flatpak-builder
```

APT based distributions (Debian, Ubuntu, etc.)

```bash
sudo apt install flatpak-builder
```

Arch based distributions (Arch Linux, Manjaro, etc.)

```bash
sudo pacman -S flatpak-builder
```

#### Flatpak SDKs

First, add the Flathub repository if you don't have it already:

```bash
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
```

Then install the GNOME SDKs and extensions:

```bash
flatpak --user install org.gnome.Sdk//49 org.gnome.Platform//49
flatpak --user install org.freedesktop.Sdk.Extension.node20//25.08 org.freedesktop.Sdk.Extension.typescript//25.08
```

After the Flatpak SDKs are installed, install the project dependencies:

```bash
npm install
```

**Build and Run via VS Code:**

1. Open the project directory in VS Code
2. You should see a box icon on the bottom left with the application ID `org.redvulps.nandu`
3. Open the command palette (Ctrl+Shift+P) and select **Flatpak: Build**
4. Once built, select **Flatpak: Run** from the command palette

After your initial build, you can use **Flatpak: Build and Run** to do both steps at once.

**Build and Run via Terminal:**

To build the application:

```bash
flatpak-builder --user flatpak_app build-aux/flatpak/org.redvulps.nandu.json
```

To run the application:

```bash
flatpak-builder --run flatpak_app build-aux/flatpak/org.redvulps.nandu.json org.redvulps.nandu
```

## Updating GObject Introspection Types

This project uses [@ts-for-gir](https://github.com/gjsify/ts-for-gir) to generate TypeScript type definitions for GNOME libraries. The types are located in the `gi-types/` directory.

To update types when GNOME libraries are updated:

```bash
npm run update:types
```

**Note:** Type generation requires GIR files to be available on your system.

## Architecture

Nandu is built using:

- **GTK4**: Modern GNOME toolkit for building the UI
- **libadwaita**: GNOME's adaptive UI library for beautiful native interfaces
- **TypeScript**: Type-safe application logic
- **GJS**: GNOME JavaScript bindings for accessing GTK and system APIs
- **Meson**: Fast and user-friendly build system

For more details on the project structure and development guidelines, see [AGENTS.md](./AGENTS.md).

## Contributing

Contributions are welcome! This project is in early development, so there are many opportunities to help shape its direction.

## Resources

- [GNOME Developer Documentation](https://developer.gnome.org/documentation/)
- [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/)
- [GJS Guide](https://gjs.guide/)
- [Docker Engine API](https://docs.docker.com/engine/api/)

## License

MIT License - See LICENSE file for details.
