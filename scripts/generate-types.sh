#!/bin/bash
# Script to generate GObject Introspection types using ts-for-gir
#
# NOTE: This script should be run inside the flatpak build environment
# where GIR files are available. You can run it during flatpak-builder build,
# or manually using:
#   flatpak-builder --run flatpak_app build-aux/flatpak/org.redvulps.nandu.json npm run generate:types

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    elif [ -f /etc/fedora-release ]; then
        echo "fedora"
    else
        echo "unknown"
    fi
}

check_gir_availability() {
    local gir_found=false
    local distro=$(detect_distro)

    # Check common GIR locations
    if [ -f /usr/share/gir-1.0/Gtk-4.0.gir ] || \
       [ -f /usr/lib/gir-1.0/Gtk-4.0.gir ] || \
       [ -f /usr/lib/x86_64-linux-gnu/gir-1.0/Gtk-4.0.gir ]; then
        gir_found=true
    fi

    if [ "$gir_found" = false ]; then
        echo "⚠️  GTK4 GIR files not found!"
        echo ""
        echo "To generate types, you need GNOME development packages installed."
        echo ""

        case "$distro" in
            ubuntu|debian|linuxmint|pop)
                echo "For Debian/Ubuntu-based systems, install:"
                echo "  sudo apt-get install libgtk-4-dev libadwaita-1-dev gobject-introspection"
                ;;
            fedora|rhel|centos|rocky|almalinux)
                echo "For Fedora/RHEL-based systems, install:"
                echo "  sudo dnf install gtk4-devel libadwaita-devel gobject-introspection-devel"
                ;;
            arch|manjaro)
                echo "For Arch-based systems, install:"
                echo "  sudo pacman -S gtk4 libadwaita gobject-introspection"
                ;;
            opensuse*|suse)
                echo "For openSUSE-based systems, install:"
                echo "  sudo zypper install gtk4-devel libadwaita-devel gobject-introspection-devel"
                ;;
            *)
                echo "Install GTK4 development packages for your distribution."
                echo "Common package names:"
                echo "  - Debian/Ubuntu: libgtk-4-dev libadwaita-1-dev"
                echo "  - Fedora/RHEL:   gtk4-devel libadwaita-devel"
                ;;
        esac

        echo ""
        echo "Alternatively, run type generation in the Flatpak SDK environment:"
        echo "  flatpak-builder --run flatpak_app build-aux/flatpak/org.redvulps.nandu.json npm run generate:types"
        echo ""

        read -p "Do you want to continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

echo "======================================================"
echo " Generating GI TypeScript Types"
echo "======================================================"
echo ""
echo "This will regenerate TypeScript definitions for GObject"
echo "Introspection libraries used in this project."
echo ""

check_gir_availability

echo "→ Running ts-for-gir..."
npx ts-for-gir generate

echo ""
echo "✓ Type generation complete!"
echo ""
echo "Generated types are in: ./gi-types/"
