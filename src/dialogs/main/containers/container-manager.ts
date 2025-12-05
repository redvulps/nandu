import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import { DockerClient } from '../../../docker/client.js';
import {
  ContainerSummary,
  getSummaryData,
} from '../../../docker/container/summary.js';
import {
  ContainerNetworkData,
  getNetworkData,
} from '../../../docker/container/network.js';
import { getMountsData, ContainerMount } from '../../../docker/container/mounts.js';
import {
  ContainerDiskUsage,
  getDiskUsageData,
} from '../../../docker/container/disk-usage.js';
import { getContainerLogs } from '../../../docker/container/logs.js';
import { monitorUntilStartedOrExited } from '../../../docker/container/monitor.js';

/**
 * A window class that manages and displays detailed information about a Docker container.
 * It provides functionality to view summary, network, disk usage, mounts, and logs,
 * as well as perform actions like start, stop, restart, and delete.
 */
export class ContainerManager extends Adw.Window {
  private _contentStack!: Adw.ViewStack;
  private _actionsMenuButton!: Gtk.MenuButton;
  private _actionSpinner!: Gtk.Spinner;

  // Summary Tab
  private _nameRow!: Adw.ActionRow;
  private _imageRow!: Adw.ActionRow;
  private _statusRow!: Adw.ActionRow;
  private _idRow!: Adw.ActionRow;
  private _commandRow!: Adw.ActionRow;
  private _createdRow!: Adw.ActionRow;
  private _copyNameButton!: Gtk.Button;
  private _copyImageButton!: Gtk.Button;
  private _copyIdButton!: Gtk.Button;

  // Disk Usage Tab
  private _sizeRwRow!: Adw.ActionRow;
  private _sizeRootFsRow!: Adw.ActionRow;
  private _sizeVolumesRow!: Adw.ActionRow;
  private _sizeTotalRow!: Adw.ActionRow;

  // Network Tab
  private _networkStack!: Gtk.Stack;
  private _ipRow!: Adw.ActionRow;
  private _gatewayRow!: Adw.ActionRow;
  private _macRow!: Adw.ActionRow;
  private _portsRow!: Adw.ActionRow;
  private _copyIpButton!: Gtk.Button;

  // Mounts Tab
  private _mountsList!: Gtk.ListBox;
  private _mountsStack!: Gtk.Stack;

  // Log Tab
  private _logView!: Gtk.TextView;
  private _refreshLogButton!: Gtk.Button;

  private dockerClient: DockerClient;
  private containerId: string;
  private containerSummary?: ContainerSummary;
  private containerNetwork?: ContainerNetworkData;
  private containerMounts?: ContainerMount[];
  private containerDiskUsage?: ContainerDiskUsage;
  private containerLogs?: string;
  private containerDeleted = false;
  private onDeleted?: () => void;
  private isMonitoring = false;

  static {
    // In development mode (npm start), load UI from filesystem
    // In production (flatpak), load from compiled resources

    const template = 'resource:///org/redvulps/nandu/container-manager.ui';
    Gio.resources_lookup_data(
      '/org/redvulps/nandu/container-manager.ui',
      Gio.ResourceLookupFlags.NONE
    );

    GObject.registerClass(
      {
        GTypeName: 'NanduContainerManager',
        Template: template,
        InternalChildren: [
          'actionsMenuButton',
          'actionSpinner',
          'contentStack',
          'nameRow',
          'imageRow',
          'statusRow',
          'idRow',
          'commandRow',
          'createdRow',
          'copyNameButton',
          'copyImageButton',
          'copyIdButton',
          'sizeRwRow',
          'sizeRootFsRow',
          'sizeVolumesRow',
          'sizeTotalRow',
          'networkStack',
          'ipRow',
          'gatewayRow',
          'macRow',
          'portsRow',
          'copyIpButton',
          'mountsList',
          'mountsStack',
          'logView',
          'refreshLogButton',
        ],
      },
      this
    );
  }

  /**
   * Creates a new instance of ContainerManager.
   *
   * @param dockerClient - The Docker client instance for API interactions.
   * @param containerId - The ID of the container to manage.
   * @param onDeleted - Optional callback to be executed when the container is deleted.
   */
  constructor(
    dockerClient: DockerClient,
    containerId: string,
    onDeleted?: () => void
  ) {
    super({
      modal: true,
    });

    this.dockerClient = dockerClient;
    this.containerId = containerId;
    this.onDeleted = onDeleted;

    void this.loadData();

    this._contentStack.connect('notify::visible-child', () => {
      void this.loadData();
    });

    //#region Copy buttons
    this._copyNameButton.connect('clicked', () =>
      this.copyToClipboard(this._nameRow.get_subtitle())
    );
    this._copyImageButton.connect('clicked', () =>
      this.copyToClipboard(this._imageRow.get_subtitle())
    );
    this._copyIdButton.connect('clicked', () =>
      this.copyToClipboard(this._idRow.get_subtitle())
    );
    this._copyIpButton.connect('clicked', () =>
      this.copyToClipboard(this._ipRow.get_subtitle())
    );
    //#endregion

    this._refreshLogButton.connect('clicked', () => void this.loadLogs());

    this.setupActions();
  }

  /**
   * Sets up the action group and actions for the window.
   * Defines actions for start, stop, restart, and delete operations.
   */
  private setupActions(): void {
    const actionGroup = Gio.SimpleActionGroup.new();

    const startAction = Gio.SimpleAction.new('start', null);
    startAction.connect('activate', () => void this.handleStart());
    actionGroup.add_action(startAction);

    const stopAction = Gio.SimpleAction.new('stop', null);
    stopAction.connect('activate', () => this.handleStop());
    actionGroup.add_action(stopAction);

    const restartAction = Gio.SimpleAction.new('restart', null);
    restartAction.connect('activate', () => this.handleRestart());
    actionGroup.add_action(restartAction);

    const deleteAction = Gio.SimpleAction.new('delete', null);
    deleteAction.connect('activate', () => this.handleDelete());
    actionGroup.add_action(deleteAction);

    this.insert_action_group('container', actionGroup);
  }

  /**
   * Loads data for the currently visible tab.
   * Fetches data asynchronously and updates the UI.
   * Handles errors by displaying a message dialog.
   */
  private async loadData(): Promise<void> {
    const currentTab = this._contentStack.get_visible_child_name();

    try {
      if (currentTab === 'summary') {
        await this.loadSummary();
      } else if (currentTab === 'network') {
        await this.loadNetwork();
      } else if (currentTab === 'disk') {
        await this.loadDiskUsage();
      } else if (currentTab === 'mounts') {
        await this.loadMounts();
      } else if (currentTab === 'logs') {
        await this.loadLogs();
      }
    } catch (error) {
      console.error(`Failed to load container details: ${String(error)}`);
      const dialog = new Adw.MessageDialog({
        heading: 'Error',
        body: `Failed to load container details: ${String(error)}`,
        transient_for: this,
      });

      dialog.add_response('close', 'Close');
      dialog.connect('response', () => dialog.close());
      dialog.present();
    }
  }

  /**
   * Loads and displays the container summary information.
   * Updates name, image, status, ID, command, and creation time rows.
   */
  private async loadSummary(): Promise<void> {
    const summary = await getSummaryData(this.dockerClient, this.containerId);

    this._nameRow.set_subtitle(summary.name);
    this._imageRow.set_subtitle(summary.image);
    this._statusRow.set_subtitle(summary.status);
    this._idRow.set_subtitle(summary.id);
    this._commandRow.set_subtitle(summary.command);
    this._createdRow.set_subtitle(summary.created);
  }

  /**
   * Loads and displays the container network information.
   * Updates IP, gateway, MAC address, and ports.
   * Shows an empty state if the container is not running.
   */
  private async loadNetwork(): Promise<void> {
    const network = await getNetworkData(this.dockerClient, this.containerId);

    if (network.isRunning) {
      this._networkStack.set_visible_child_name('list');
      this._ipRow.set_subtitle(network.ip);
      this._gatewayRow.set_subtitle(network.gateway);
      this._macRow.set_subtitle(network.mac);
      this._portsRow.set_subtitle(network.ports);
    } else {
      this._networkStack.set_visible_child_name('empty');
    }
  }

  /**
   * Loads and displays the container disk usage information.
   * Updates read/write size, root filesystem size, volume size, and total size.
   */
  private async loadDiskUsage(): Promise<void> {
    try {
      const diskUsage = await getDiskUsageData(
        this.dockerClient,
        this.containerId
      );

      this._sizeRwRow.set_subtitle(diskUsage.rw);
      this._sizeRootFsRow.set_subtitle(diskUsage.rootFs);
      this._sizeVolumesRow.set_subtitle(diskUsage.volumes);
      this._sizeTotalRow.set_subtitle(diskUsage.total);
    } catch (error) {
      console.error(`Failed to load disk usage: ${String(error)}`);
    }
  }

  /**
   * Loads and displays the container mounts information.
   * Populates the mounts list with source and destination paths.
   * Adds copy buttons for source paths.
   */
  private async loadMounts(): Promise<void> {
    this._mountsList.remove_all();

    const mounts = await getMountsData(this.dockerClient, this.containerId);

    if (mounts.length > 0) {
      this._mountsStack.set_visible_child_name('list');
      for (const mount of mounts) {
        let subtitle = mount.destination;
        if (mount.size) {
          subtitle += ` (${mount.size})`;
        }

        const row = new Adw.ActionRow({
          title: mount.source,
          subtitle: subtitle,
        });
        if (mount.type === 'volume') {
          row.set_icon_name('folder-symbolic');
        } else {
          row.set_icon_name('drive-harddisk-symbolic');
        }

        // Add copy button
        const copyButton = new Gtk.Button({
          icon_name: 'edit-copy-symbolic',
          tooltip_text: 'Copy Source Path',
          valign: Gtk.Align.CENTER,
          css_classes: ['flat'],
        });
        copyButton.connect('clicked', () => this.copyToClipboard(mount.source));
        row.add_suffix(copyButton);

        this._mountsList.append(row);
      }
    } else {
      this._mountsStack.set_visible_child_name('empty');
    }
  }

  /**
   * Copies the provided text to the system clipboard.
   *
   * @param text - The text to copy. If null or empty, no action is taken.
   */
  private copyToClipboard(text: string | null): void {
    if (!text) {
      return;
    }
    const clipboard = this.get_display().get_clipboard();
    clipboard.set(text);
  }

  /**
   * Loads and displays the container logs.
   * Disables the refresh button while loading.
   */
  private async loadLogs(): Promise<void> {
    this._refreshLogButton.set_sensitive(false);
    try {
      const logs = await getContainerLogs(this.dockerClient, this.containerId);
      this._logView.get_buffer().set_text(logs, -1);
    } finally {
      this._refreshLogButton.set_sensitive(true);
    }
  }

  /**
   * Handles the start action.
   * Attempts to start the container and begins monitoring its state.
   * Shows an error dialog if the operation fails.
   */
  private async handleStart(): Promise<void> {
    try {
      await this.dockerClient.startContainer(this.containerId);
      void this.startMonitoring();
    } catch (error) {
      this.showErrorDialog('Failed to Start Container', String(error));
    }
  }

  /**
   * Handles the stop action.
   * Displays a confirmation dialog before stopping the container.
   */
  private handleStop(): void {
    const dialog = new Adw.AlertDialog({
      heading: 'Stop Container?',
      body: 'Are you sure you want to stop this container?',
    });

    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('stop', 'Stop');
    dialog.set_response_appearance('stop', Adw.ResponseAppearance.DESTRUCTIVE);
    dialog.set_default_response('cancel');
    dialog.set_close_response('cancel');

    dialog.connect('response', (_dialog, response) => {
      if (response === 'stop') {
        void this.executeStop();
      }
    });

    dialog.present(this);
  }

  /**
   * Executes the stop container operation.
   * Attempts to stop the container and begins monitoring its state.
   * Shows an error dialog if the operation fails.
   */
  private async executeStop(): Promise<void> {
    try {
      await this.dockerClient.stopContainer(this.containerId);
      void this.startMonitoring();
    } catch (error) {
      this.showErrorDialog('Failed to Stop Container', String(error));
    }
  }

  /**
   * Handles the restart action.
   * Displays a confirmation dialog before restarting the container.
   */
  private handleRestart(): void {
    const dialog = new Adw.AlertDialog({
      heading: 'Restart Container?',
      body: 'Are you sure you want to restart this container?',
    });

    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('restart', 'Restart');
    dialog.set_response_appearance(
      'restart',
      Adw.ResponseAppearance.DESTRUCTIVE
    );
    dialog.set_default_response('cancel');
    dialog.set_close_response('cancel');

    dialog.connect('response', (_dialog, response) => {
      if (response === 'restart') {
        void this.executeRestart();
      }
    });

    dialog.present(this);
  }

  /**
   * Executes the restart container operation.
   * Attempts to restart the container and begins monitoring its state.
   * Shows an error dialog if the operation fails.
   */
  private async executeRestart(): Promise<void> {
    try {
      await this.dockerClient.restartContainer(this.containerId);
      void this.startMonitoring();
    } catch (error) {
      this.showErrorDialog('Failed to Restart Container', String(error));
    }
  }

  /**
   * Handles the delete action.
   * Displays a confirmation dialog before deleting the container.
   */
  private handleDelete(): void {
    const containerName = this.containerSummary?.name || 'this container';
    const dialog = new Adw.AlertDialog({
      heading: 'Delete Container?',
      body: `Are you sure you want to delete ${containerName}?\n\nThis action is irreversible and will permanently remove the container.`,
    });
    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('delete', 'Delete');
    dialog.set_response_appearance(
      'delete',
      Adw.ResponseAppearance.DESTRUCTIVE
    );
    dialog.set_default_response('cancel');
    dialog.set_close_response('cancel');

    dialog.connect('response', (_dialog, response) => {
      if (response === 'delete') {
        void this.executeDelete();
      }
    });

    dialog.present(this);
  }

  /**
   * Executes the delete container operation.
   * Forces removal of the container.
   * Triggers the onDeleted callback and closes the window upon success.
   * Shows an error dialog if the operation fails.
   */
  private async executeDelete(): Promise<void> {
    try {
      // Force delete to handle running containers
      await this.dockerClient.removeContainer(this.containerId, true);
      this.containerDeleted = true;
      if (this.onDeleted) {
        this.onDeleted();
      }
      this.close();
    } catch (error) {
      this.showErrorDialog('Failed to Delete Container', String(error));
    }
  }

  /**
   * Displays an error dialog with the specified heading and body.
   *
   * @param heading - The title of the error dialog.
   * @param body - The message body of the error dialog.
   */
  private showErrorDialog(heading: string, body: string): void {
    const dialog = new Adw.AlertDialog({
      heading,
      body,
    });
    dialog.add_response('close', 'Close');
    dialog.set_default_response('close');
    dialog.set_close_response('close');
    dialog.present(this);
  }

  /**
   * Starts monitoring the container's state.
   * Shows a spinner and hides the action menu while monitoring.
   * Updates the status row as the state changes.
   * Refreshes data once the container starts or exits.
   */
  private async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Show spinner, hide menu button
    this._actionSpinner.set_visible(true);
    this._actionSpinner.set_spinning(true);
    this._actionsMenuButton.set_visible(false);

    try {
      await monitorUntilStartedOrExited(
        this.dockerClient,
        this.containerId,
        (status) => {
          this._statusRow.set_subtitle(status);
        }
      );

      await this.loadData();
    } catch (error) {
      console.error(`Monitoring error: ${String(error)}`);
      await this.loadData();
    } finally {
      this.isMonitoring = false;

      // Hide spinner, show menu button
      this._actionSpinner.set_spinning(false);
      this._actionSpinner.set_visible(false);
      this._actionsMenuButton.set_visible(true);
    }
  }
}
