#!/usr/bin/env bash

# Nandu Development Build Script
# This script builds the application with meson and runs it for local development

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🐋 Nandu Development Build${NC}"
echo ""

export PATH="$(pwd)/node_modules/.bin:$PATH"

# region Tool Checks
echo "Checking for required tools..."

if ! command -v meson &> /dev/null; then
    echo -e "${RED}❌ Error: meson is not installed${NC}"
    echo "Please install meson:"
    echo "  Ubuntu/Debian: sudo apt install meson"
    echo "  Fedora: sudo dnf install meson"
    echo "  Arch: sudo pacman -S meson"
    exit 1
fi

if ! command -v ninja &> /dev/null; then
    echo -e "${RED}❌ Error: ninja is not installed${NC}"
    echo "Please install ninja:"
    echo "  Ubuntu/Debian: sudo apt install ninja-build"
    echo "  Fedora: sudo dnf install ninja-build"
    echo "  Arch: sudo pacman -S ninja"
    exit 1
fi

if ! command -v gjs &> /dev/null; then
    echo -e "${RED}❌ Error: gjs is not installed${NC}"
    echo "Please install gjs (GNOME JavaScript):"
    echo "  Ubuntu/Debian: sudo apt install gjs"
    echo "  Fedora: sudo dnf install gjs"
    echo "  Arch: sudo pacman -S gjs"
    exit 1
fi

if ! pkg-config --exists gjs-1.0; then
    echo -e "${RED}❌ Error: gjs-1.0 development files not found${NC}"
    echo "Please install gjs development package:"
    echo "  Ubuntu/Debian: sudo apt install libgjs-dev"
    echo "  Fedora: sudo dnf install gjs-devel"
    echo "  Arch: sudo pacman -S gjs"
    exit 1
fi

if ! command -v glib-compile-schemas &> /dev/null; then
    echo -e "${RED}❌ Error: glib-compile-schemas is not installed${NC}"
    echo "Please install glib development tools:"
    echo "  Ubuntu/Debian: sudo apt install libglib2.0-dev-bin"
    echo "  Fedora: sudo dnf install glib2-devel"
    echo "  Arch: sudo pacman -S glib2"
    exit 1
fi

echo -e "${GREEN}✓ All required tools found${NC}"
echo ""
# endregion

# region Build Setup
BUILD_DIR="_build"

if [ ! -f "$BUILD_DIR/build.ninja" ]; then
    echo "Setting up build directory..."

    # If directory exists but is not a valid meson build (no build.ninja), clean it
    if [ -d "$BUILD_DIR" ]; then
        echo "Cleaning invalid build directory..."
        rm -rf "$BUILD_DIR"
    fi

    meson setup "$BUILD_DIR" --prefix="$(pwd)/_install"
    echo ""
fi

# endregion

echo "Building project with meson..."
meson compile -C "$BUILD_DIR"
echo ""

# Compile schemas locally for development
echo "Compiling GSettings schemas..."
mkdir -p "$BUILD_DIR/gschemas"
cp data/org.redvulps.nandu.gschema.xml "$BUILD_DIR/gschemas/"
glib-compile-schemas "$BUILD_DIR/gschemas"
echo ""

# Set environment variables for local development
export GSETTINGS_SCHEMA_DIR="$BUILD_DIR/gschemas"
export G_MESSAGES_DEBUG=all

# Run the application
echo -e "${GREEN}🚀 Starting Nandu...${NC}"
echo ""

cat > "$BUILD_DIR/dev-runner.js" << EOF
import Gio from 'gi://Gio';
import system from 'system';

// Load resources
try {
    const srcRes = Gio.Resource.load('$BUILD_DIR/src/org.redvulps.nandu.src.gresource');
    srcRes._register();

    const dataRes = Gio.Resource.load('$BUILD_DIR/data/org.redvulps.nandu.data.gresource');
    dataRes._register();
} catch (e) {
    console.warn('Failed to load resources:', e);
}

// Import and run main
const module = await import('./tsc-out/main.js');
const exitCode = await module.main(system.programArgs);
system.exit(exitCode);
EOF

gjs -m "$BUILD_DIR/dev-runner.js"
