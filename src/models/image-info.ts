import GObject from 'gi://GObject';
import { ImageData } from 'src/docker/types';

export class ImageInfo extends GObject.Object {
  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduImageInfo',
        Properties: {
          id: GObject.ParamSpec.string(
            'id',
            'ID',
            'Image ID',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          'short-id': GObject.ParamSpec.string(
            'short-id',
            'Short ID',
            'Shortened image ID',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          name: GObject.ParamSpec.string(
            'name',
            'Name',
            'Image name (repository)',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          tag: GObject.ParamSpec.string(
            'tag',
            'Tag',
            'Image tag',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          size: GObject.ParamSpec.int64(
            'size',
            'Size',
            'Image size in bytes',
            GObject.ParamFlags.READWRITE,
            0,
            Number.MAX_SAFE_INTEGER,
            0
          ),
          'size-formatted': GObject.ParamSpec.string(
            'size-formatted',
            'Size Formatted',
            'Human-readable image size',
            GObject.ParamFlags.READWRITE,
            ''
          ),
          created: GObject.ParamSpec.int64(
            'created',
            'Created',
            'Creation timestamp',
            GObject.ParamFlags.READWRITE,
            0,
            Number.MAX_SAFE_INTEGER,
            0
          ),
          'in-use': GObject.ParamSpec.boolean(
            'in-use',
            'In Use',
            'Whether the image is used by any container',
            GObject.ParamFlags.READWRITE,
            false
          ),
          'container-count': GObject.ParamSpec.int(
            'container-count',
            'Container Count',
            'Number of containers using this image',
            GObject.ParamFlags.READWRITE,
            0,
            1000,
            0
          ),
        },
      },
      this
    );
  }

  private _id = '';
  private _shortId = '';
  private _name = '';
  private _tag = '';
  private _size = 0;
  private _sizeFormatted = '';
  private _created = 0;
  private _inUse = false;
  private _containerCount = 0;

  get id(): string {
    return this._id;
  }

  get shortId(): string {
    return this._shortId;
  }

  get name(): string {
    return this._name;
  }

  get tag(): string {
    return this._tag;
  }

  get size(): number {
    return this._size;
  }

  get sizeFormatted(): string {
    return this._sizeFormatted;
  }

  get created(): number {
    return this._created;
  }

  get inUse(): boolean {
    return this._inUse;
  }

  get containerCount(): number {
    return this._containerCount;
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

  set tag(value: string) {
    if (this._tag === value) {
      return;
    }
    this._tag = value;
    this.notify('tag');
  }

  set size(value: number) {
    if (this._size === value) {
      return;
    }
    this._size = value;
    this.notify('size');
  }

  set sizeFormatted(value: string) {
    if (this._sizeFormatted === value) {
      return;
    }
    this._sizeFormatted = value;
    this.notify('size-formatted');
  }

  set created(value: number) {
    if (this._created === value) {
      return;
    }
    this._created = value;
    this.notify('created');
  }

  set inUse(value: boolean) {
    if (this._inUse === value) {
      return;
    }
    this._inUse = value;
    this.notify('in-use');
  }

  set containerCount(value: number) {
    if (this._containerCount === value) {
      return;
    }
    this._containerCount = value;
    this.notify('container-count');
  }

  /**
   * Creates an ImageInfo from raw image data.
   */
  static fromImageData(data: ImageData, sizeFormatted: string): ImageInfo {
    const info = new ImageInfo();
    info.id = data.id;
    info.shortId = data.shortId;
    info.name = data.name;
    info.tag = data.tag;
    info.size = data.size;
    info.sizeFormatted = sizeFormatted;
    info.created = data.created;
    info.inUse = data.inUse;
    info.containerCount = data.containerCount;
    return info;
  }
}
