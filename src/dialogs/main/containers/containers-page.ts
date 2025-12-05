import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import { ComposeItem } from './compose-item.js';
import { ContainerItem } from './container-item.js';
import { DockerClient } from '../../../docker/client.js';
import type { ContainerData } from '../../../docker/types.js';
import { ContainerInfo } from '../../../models/container-info.js';

export class ContainersPage extends Gtk.Box {
  private _contentStack!: Gtk.Stack;
  private _containerListBox!: Gtk.ListBox;
  private _errorPage!: Adw.StatusPage;
  private _toastOverlay!: Adw.ToastOverlay;

  private dockerClient: DockerClient | null = null;
  private containers: ContainerInfo[] = [];
  private composeGroups = new Map<string, ContainerInfo[]>();
  private searchQuery = '';

  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduContainersPage',
        Template:
          'resource:///org/redvulps/nandu/dialogs/main/containers/containers-page.ui',
        InternalChildren: [
          'contentStack',
          'containerListBox',
          'errorPage',
          'toastOverlay',
        ],
        Signals: {
          'open-manager': {
            param_types: [GObject.TYPE_STRING],
          },
          'open-compose': {
            param_types: [GObject.TYPE_STRING],
          },
        },
      },
      this
    );
  }

  constructor(params?: Partial<Gtk.Box.ConstructorProps>) {
    super(params);

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
  }

  public setDockerClient(client: DockerClient | null): void {
    this.dockerClient = client;
    if (client) {
      void this.loadContainers();
    }
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase();
    this._containerListBox.invalidate_filter();
  }

  public getComposeContainers(projectName: string): ContainerInfo[] {
    return this.composeGroups.get(projectName) || [];
  }

  public getDockerClient(): DockerClient | null {
    return this.dockerClient;
  }

  public async loadContainers(): Promise<void> {
    if (!this.dockerClient) {
      console.error('Docker client not initialized');
      return;
    }

    if (this.containers.length === 0) {
      this._contentStack.set_visible_child_name('loading');
    }

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
      this.showError(`Failed to load containers: ${String(error)}`);
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
            this.emit('open-compose', info.composeProject);
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
          this.emit('open-manager', id)
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
}
