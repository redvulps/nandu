import GObject from 'gi://GObject';
import { ContainerData } from 'src/docker/types';

export class ContainerInfo extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduContainerInfo',
        Properties: {
          id: GObject.ParamSpec.string(
            'id',
            'ID',
            'Container ID',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          'short-id': GObject.ParamSpec.string(
            'short-id',
            'Short ID',
            'Shortened container ID',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          name: GObject.ParamSpec.string(
            'name',
            'Name',
            'Container name',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          image: GObject.ParamSpec.string(
            'image',
            'Image',
            'Container image name',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          status: GObject.ParamSpec.string(
            'status',
            'Status',
            'Container status description',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          state: GObject.ParamSpec.string(
            'state',
            'State',
            'Container state (running, exited, etc.)',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          'is-running': GObject.ParamSpec.boolean(
            'is-running',
            'Is Running',
            'Whether the container is currently running',
            GObject.ParamFlags.READWRITE,
            false
          ),
          'is-compose': GObject.ParamSpec.boolean(
            'is-compose',
            'Is Compose',
            'Whether the container is part of a compose project',
            GObject.ParamFlags.READWRITE,
            false
          ),
          'compose-project': GObject.ParamSpec.string(
            'compose-project',
            'Compose Project',
            'Name of the compose project (if applicable)',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          'compose-service': GObject.ParamSpec.string(
            'compose-service',
            'Compose Service',
            'Name of the compose service (if applicable)',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          ports: GObject.ParamSpec.string(
            'ports',
            'Ports',
            'Port mappings',
            GObject.ParamFlags.READWRITE,
            ''
          ),
        },
      },
      this
    );
  }

  private _id = '';
  private _shortId = '';
  private _name = '';
  private _image = '';
  private _status = '';
  private _state = '';
  private _isRunning = false;
  private _isCompose = false;
  private _composeProject = '';
  private _composeService = '';
  private _ports = '';

  get id(): string {
    return this._id;
  }

  get shortId(): string {
    return this._shortId;
  }

  get name(): string {
    return this._name;
  }

  get image(): string {
    return this._image;
  }

  get status(): string {
    return this._status;
  }

  get state(): string {
    return this._state;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get isCompose(): boolean {
    return this._isCompose;
  }

  get composeProject(): string {
    return this._composeProject;
  }

  get composeService(): string {
    return this._composeService;
  }

  get ports(): string {
    return this._ports;
  }

  set id(value: string) {
    if (this._id === value) {
      return;
    }
    this._id = value;
    this.notify('id');
  }

  set shortId(value: string) {
    if (this._shortId === value) {
      return;
    }
    this._shortId = value;
    this.notify('short-id');
  }

  set name(value: string) {
    if (this._name === value) {
      return;
    }
    this._name = value;
    this.notify('name');
  }

  set image(value: string) {
    if (this._image === value) {
      return;
    }
    this._image = value;
    this.notify('image');
  }

  set status(value: string) {
    if (this._status === value) {
      return;
    }
    this._status = value;
    this.notify('status');
  }

  set state(value: string) {
    if (this._state === value) {
      return;
    }
    this._state = value;
    this.notify('state');
  }

  set isRunning(value: boolean) {
    if (this._isRunning === value) {
      return;
    }
    this._isRunning = value;
    this.notify('is-running');
  }

  set isCompose(value: boolean) {
    if (this._isCompose === value) {
      return;
    }
    this._isCompose = value;
    this.notify('is-compose');
  }

  set composeProject(value: string) {
    if (this._composeProject === value) {
      return;
    }
    this._composeProject = value;
    this.notify('compose-project');
  }

  set composeService(value: string) {
    if (this._composeService === value) {
      return;
    }
    this._composeService = value;
    this.notify('compose-service');
  }

  set ports(value: string) {
    if (this._ports === value) {
      return;
    }
    this._ports = value;
    this.notify('ports');
  }

  static fromContainerData(container: ContainerData): ContainerInfo {
    const info = new ContainerInfo();
    info.id = container.id;
    info.shortId = container.id.slice(0, 12);
    info.name = container.name;
    info.image = container.image;
    info.status = container.status;
    info.state = container.state;
    info.isRunning = container.isRunning;
    info.isCompose = container.isCompose;
    info.composeProject = container.composeInfo?.project || '';
    info.composeService = container.composeInfo?.service || '';
    info.ports = container.ports.join(', ');
    return info;
  }
}
