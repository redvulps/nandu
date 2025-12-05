import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ComposeDetail } from './containers/compose-detail.js';
import { ComposeItem } from './containers/compose-item.js';
import { ContainerItem } from './containers/container-item.js';
import { ContainerManager } from './containers/container-manager.js';
import { DockerClient } from '../../docker/client.js';
import type { ContainerData } from '../../docker/types.js';
import { ContainerInfo } from '../../models/container-info.js';
import { SettingsManager } from '../../settings-manager.js';

/** Main application window that manages Docker containers and compose projects. */
export class MainDialog extends Adw.ApplicationWindow {
  private _contentStack!: Gtk.Stack;
  private _containerListBox!: Gtk.ListBox;
  private _refreshButton!: Gtk.Button;
  private _errorPage!: Adw.StatusPage;
  private _toastOverlay!: Adw.ToastOverlay;
  private _searchEntry!: Gtk.SearchEntry;
  private _navigationView!: Adw.NavigationView;

  private dockerClient: DockerClient | null = null;
  private settings: SettingsManager;
  private containers: ContainerInfo[] = [];
  private composeGroups = new Map<string, ContainerInfo[]>();
  private searchQuery = '';

  static {
    const template = 'resource:///org/redvulps/nandu/window.ui';
    Gio.resources_lookup_data(
      '/org/redvulps/nandu/window.ui',
      Gio.ResourceLookupFlags.NONE
    );

    GObject.registerClass(
      {
        GTypeName: 'NanduWindow',
        Template: template,
        InternalChildren: [
          'contentStack',
          'containerListBox',
          'refreshButton',
          'errorPage',
          'toastOverlay',
          'searchEntry',
          'navigationView',
        ],
      },
      this
    );
  }

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
    super(params);

    this.settings = SettingsManager.getInstance();

    if (this.settings.isSetupComplete()) {
      const socketPath = this.settings.getEffectiveSocketPath();
      this.dockerClient = new DockerClient(socketPath);
    }

    this._refreshButton.connect('clicked', () => {
      void this.loadContainers();
    });

    this._searchEntry.connect('search-changed', () => {
      this.searchQuery = this._searchEntry.get_text().toLowerCase();
      this._containerListBox.invalidate_filter();
    });

    const toggleSearchAction = new Gio.SimpleAction({
      name: 'toggle-search',
    });
    toggleSearchAction.connect('activate', () => {
      const visiblePage = this._navigationView.get_visible_page();

      if (visiblePage && visiblePage instanceof ComposeDetail) {
        visiblePage.toggleSearch();
      } else {
        this._searchEntry.grab_focus();
      }
    });
    this.add_action(toggleSearchAction);

    this._containerListBox.set_filter_func((row) => {
      if (!this.searchQuery) {
        return true;
      }

      const child = row.get_child();
      if (!child) {
        return false;
      }

      if (child instanceof ComposeItem) {
        const projectName = child.getProjectName().toLowerCase();
        return projectName.includes(this.searchQuery);
      }

      if (child instanceof ContainerItem) {
        const info = child.containerInfo;
        if (!info) {
          return false;
        }

        const searchableText = [
          info.name,
          info.image,
          info.composeProject,
          info.composeService,
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(this.searchQuery);
      }

      return true;
    });

    if (this.dockerClient) {
      void this.loadContainers();
    }

    this.set_default_widget(this._containerListBox);
  }

  public async loadContainers(): Promise<void> {
    if (!this.dockerClient) {
      console.error('Docker client not initialized');
      return;
    }

    if (this.containers.length === 0) {
      this._contentStack.set_visible_child_name('loading');
    }

    this._refreshButton.set_sensitive(false);

    try {
      const containerData = await this.dockerClient.listContainers(true);
      this.updateContainerList(containerData);

      if (containerData.length === 0) {
        this._contentStack.set_visible_child_name('empty');
      } else {
        this._contentStack.set_visible_child_name('list');
      }
    } catch (error) {
      console.error(`Failed to load containers: ${String(error)}`);
      this.showError(`Failed to load containers: ${error}`);
    } finally {
      this._refreshButton.set_sensitive(true);
    }
  }

  private updateContainerList(containerData: ContainerData[]): void {
    this.containers = [];
    this.composeGroups.clear();

    let child = this._containerListBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this._containerListBox.remove(child);
      child = next;
    }

    const composeItemMap = new Map<string, ComposeItem>();

    for (const data of containerData) {
      const info = ContainerInfo.fromContainerData(data);
      this.containers.push(info);

      if (info.isCompose && info.composeProject) {
        if (!this.composeGroups.has(info.composeProject)) {
          this.composeGroups.set(info.composeProject, []);
        }
        this.composeGroups.get(info.composeProject)!.push(info);

        if (!composeItemMap.has(info.composeProject)) {
          const composeItem = new ComposeItem(info.composeProject);
          composeItem.connect('clicked', () => {
            this.openComposeDetail(info.composeProject);
          });
          composeItemMap.set(info.composeProject, composeItem);

          const row = new Gtk.ListBoxRow();
          row.set_child(composeItem);
          this._containerListBox.append(row);
        }
      } else {
        const item = new ContainerItem();
        item.bind(info);

        item.connect('action-start', () => {
          void this.handleContainerAction('start', info.id, item);
        });
        item.connect('action-stop', () => {
          void this.handleContainerAction('stop', info.id, item);
        });
        item.connect(
          'action-restart',
          () => void this.handleContainerAction('restart', info.id, item)
        );

        item.connect('open-manager', (_item, id: string) =>
          this.openContainerManager(id)
        );

        const row = new Gtk.ListBoxRow();
        row.set_child(item);
        this._containerListBox.append(row);
      }
    }

    composeItemMap.forEach((item, projectName) => {
      const count = this.composeGroups.get(projectName)?.length || 0;
      item.setContainerCount(count);
    });
  }

  private async handleContainerAction(
    action: 'start' | 'stop' | 'restart',
    containerId: string,
    item: ContainerItem
  ): Promise<void> {
    if (!this.dockerClient) {
      return;
    }

    item.setLoading(true);

    try {
      switch (action) {
        case 'start':
          await this.dockerClient.startContainer(containerId);
          this.showToast('Container started successfully');
          break;
        case 'stop':
          await this.dockerClient.stopContainer(containerId);
          this.showToast('Container stopped successfully');
          break;
        case 'restart':
          await this.dockerClient.restartContainer(containerId);
          this.showToast('Container restarted successfully');
          break;
      }

      await this.loadContainers();
    } catch (error) {
      console.error(`Failed to ${action} container: ${String(error)}`);
      this.showToast(`Failed to ${action} container`);
      item.setLoading(false);
    }
  }

  private showToast(message: string): void {
    const toast = new Adw.Toast({ title: message });
    this._toastOverlay.add_toast(toast);
  }

  private showError(message: string): void {
    this._errorPage.set_description(message);
    this._contentStack.set_visible_child_name('error');
  }

  public vfunc_show(): void {
    super.vfunc_show();

    if (this.dockerClient && this.containers.length === 0) {
      void this.loadContainers();
    }

    this.set_focus(null);
  }

  private openContainerManager(containerId: string): void {
    if (!this.dockerClient) {
      return;
    }

    const manager = new ContainerManager(
      this.dockerClient,
      containerId,
      () => void this.loadContainers()
    );
    manager.set_transient_for(this);
    manager.present();
  }

  private openComposeDetail(projectName: string): void {
    if (!this.dockerClient) {
      return;
    }

    const containers = this.composeGroups.get(projectName) || [];
    const detailPage = new ComposeDetail(
      projectName,
      this.dockerClient,
      containers
    );

    detailPage.connect(
      'container-action',
      (_page, action: string, containerId: string) => {
        if (action === 'open-manager') {
          this.openContainerManager(containerId);
        } else {
          void this.loadContainers();
        }
      }
    );

    this._navigationView.push(detailPage);
  }
}
